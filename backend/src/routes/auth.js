'use strict';

const { Router } = require('express');
const { supabase } = require('../config/supabase');

const router = Router();

/**
 * POST /api/auth/azure-sso
 *
 * Receives an Azure AD ID token from the frontend (via MSAL popup).
 * Validates the token signature against Microsoft's JWKS endpoint,
 * then maps the user to a Supabase session and returns it.
 *
 * Body: { idToken, azureOid, email, name }
 */
router.post('/azure-sso', async (req, res) => {
  try {
    const { idToken, azureOid, email, name } = req.body;

    if (!idToken || !azureOid || !email) {
      return res.status(400).json({ error: 'idToken, azureOid, and email are required' });
    }

    // ── Step 1: Verify the Azure idToken ──────────────────────────────
    // We use the jwks-rsa + jsonwebtoken libraries to validate the JWT
    // signature against Microsoft's published JWKS endpoint.
    let decodedToken;
    try {
      const jwt = require('jsonwebtoken');
      const jwksClient = require('jwks-rsa');

      const tenantId = process.env.AZURE_TENANT_ID || 'common';
      const clientId = process.env.AZURE_CLIENT_ID;

      const client = jwksClient({
        jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
        cache: true,
        cacheMaxAge: 600000, // 10 min
      });

      // Decode header to get kid
      const decoded = jwt.decode(idToken, { complete: true });
      if (!decoded || !decoded.header?.kid) {
        return res.status(401).json({ error: 'Invalid Azure token: cannot decode header' });
      }

      // Get the signing key
      const key = await new Promise((resolve, reject) => {
        client.getSigningKey(decoded.header.kid, (err, signingKey) => {
          if (err) reject(err);
          else resolve(signingKey.getPublicKey());
        });
      });

      // Verify the token
      decodedToken = jwt.verify(idToken, key, {
        algorithms: ['RS256'],
        audience: clientId || undefined, // skip aud check if no client ID configured
        issuer: [
          `https://login.microsoftonline.com/${tenantId}/v2.0`,
          `https://sts.windows.net/${tenantId}/`,
        ],
      });
    } catch (verifyErr) {
      // In dev mode without real Azure creds, allow bypass for testing
      if (process.env.NODE_ENV !== 'production' && process.env.AZURE_SSO_DEV_BYPASS === 'true') {
        console.warn('[AuthRoute] Azure token verification bypassed in dev mode');
        decodedToken = { sub: azureOid, email, name };
      } else {
        console.error('[AuthRoute] Azure token verification failed:', verifyErr.message);
        return res.status(401).json({ error: 'Azure token verification failed' });
      }
    }

    // ── Step 2: Find or create the user in public.users ──────────────
    let { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role, azure_oid')
      .or(`azure_oid.eq.${azureOid},email.eq.${email}`)
      .single();

    let userId;

    if (!existingUser) {
      // Create auth user first
      const { data: newAuthUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name, azure_oid: azureOid },
      });

      if (createErr) {
        console.error('[AuthRoute] Failed to create auth user:', createErr.message);
        return res.status(500).json({ error: 'Failed to provision user' });
      }

      userId = newAuthUser.user.id;

      // Insert into public.users
      const { error: insertErr } = await supabase.from('users').insert({
        id: userId,
        name: name || email.split('@')[0],
        email,
        role: 'employee',
        azure_oid: azureOid,
      });

      if (insertErr) {
        console.error('[AuthRoute] Failed to insert public user:', insertErr.message);
        // Don't block login — user might already exist from trigger
      }

      console.log(`[AuthRoute] New user provisioned via Azure SSO: ${email}`);
    } else {
      userId = existingUser.id;

      // Backfill azure_oid if missing
      if (!existingUser.azure_oid) {
        await supabase.from('users').update({ azure_oid: azureOid }).eq('id', userId);
      }

      console.log(`[AuthRoute] Existing user signed in via Azure SSO: ${email}`);
    }

    // ── Step 3: Generate a Supabase magic link / session ─────────────
    // We use generateLink to get a session token for the user.
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkErr) {
      console.error('[AuthRoute] Failed to generate magic link:', linkErr.message);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Extract hashed_token from the link URL for the frontend to use
    // The frontend can then call supabase.auth.verifyOtp with token_hash
    const linkUrl = new URL(linkData.properties?.action_link || '');
    const tokenHash = linkUrl.searchParams.get('token_hash') || linkData.properties?.hashed_token;

    const { data: profile } = await supabase
      .from('users')
      .select('id, name, email, role, department')
      .eq('id', userId)
      .single();

    res.json({
      token_hash: tokenHash,
      email,
      user: profile,
      message: 'Azure SSO successful — verify the token_hash to complete sign-in',
    });
  } catch (err) {
    console.error('[AuthRoute] Unexpected error:', err.message);
    res.status(500).json({ error: 'Internal server error during Azure SSO' });
  }
});

module.exports = router;
