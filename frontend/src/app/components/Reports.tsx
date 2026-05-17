import { useState } from 'react';
import AppSidebar from './AppSidebar';
import { Download, FileSpreadsheet, FileText, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { UserRole, Page } from '../types';

interface ReportsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  icon: React.ElementType;
  formats: ('csv' | 'xlsx')[];
  params?: Record<string, string>;
  roles: UserRole[];
}

const REPORTS: ReportConfig[] = [
  {
    id: 'achievement',
    title: 'Goal Achievement Report',
    description: 'All goals with quarterly scores, DNA analysis, and year-end projection.',
    endpoint: '/api/reports/achievement',
    icon: FileSpreadsheet,
    formats: ['xlsx', 'csv'],
    roles: ['manager', 'admin'],
  },
  {
    id: 'checkin-summary',
    title: 'Check-in Summary',
    description: 'Quarter-wise check-in data with planned vs actual for all employees.',
    endpoint: '/api/reports/checkin-summary',
    icon: FileText,
    formats: ['xlsx', 'csv'],
    roles: ['manager', 'admin'],
  },
  {
    id: 'escalation-log',
    title: 'Escalation Report',
    description: 'All escalations raised, their levels, targets, and resolution status.',
    endpoint: '/api/reports/escalations',
    icon: FileText,
    formats: ['csv'],
    roles: ['admin'],
  },
  {
    id: 'my-goals',
    title: 'My Goal Report',
    description: 'Your personal goal sheet and check-in history for the current cycle.',
    endpoint: '/api/reports/my-goals',
    icon: FileSpreadsheet,
    formats: ['xlsx', 'csv'],
    roles: ['employee', 'manager', 'admin'],
  },
];

export default function Reports({ onNavigate, onLogout, userRole }: ReportsProps) {
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [selectedFormats, setSelectedFormats] = useState<Record<string, 'csv' | 'xlsx'>>({});
  const [quarter, setQuarter] = useState('q1');
  const [pageError, setPageError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const visibleReports = REPORTS.filter(r => r.roles.includes(userRole));

  const getFormat = (id: string, formats: ('csv' | 'xlsx')[]) =>
    selectedFormats[id] || formats[0];

  const handleDownload = async (report: ReportConfig) => {
    const format = getFormat(report.id, report.formats);
    const key = `${report.id}-${format}`;
    setDownloading(prev => ({ ...prev, [key]: true }));
    setPageError('');

    try {
      const { default: api } = await import('../../lib/api');

      const response = await api.get(report.endpoint, {
        params: { format, quarter, ...report.params },
        responseType: 'blob',
      });

      // Create download link
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv';

      const blob = new Blob([response.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atomquest-${report.id}-${quarter}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(`${report.title} downloaded successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
        setPageError('Backend not connected — please start the backend server to download reports.');
      } else {
        setPageError(err.response?.data?.message || `Failed to download ${report.title}.`);
      }
    } finally {
      setDownloading(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="reports" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl mb-1">Reports & Exports</h1>
          <p className="text-gray-500 text-sm">Download data as Excel or CSV for further analysis.</p>
        </div>

        {/* Banners */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}
        {pageError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {pageError}
            <button onClick={() => setPageError('')} className="ml-auto">✕</button>
          </div>
        )}

        {/* Quarter Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Report Quarter:</label>
          <div className="flex gap-2">
            {['q1', 'q2', 'q3', 'q4'].map(q => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors uppercase ${
                  quarter === q ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-gray-400">
            Reports include data for the selected quarter
          </span>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-2 gap-6">
          {visibleReports.map(report => {
            const Icon = report.icon;
            const currentFormat = getFormat(report.id, report.formats);

            return (
              <div key={report.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#1D9E75]/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={24} className="text-[#1D9E75]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900">{report.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{report.description}</p>
                  </div>
                </div>

                {/* Format selector + Download button */}
                <div className="flex items-center gap-3">
                  {/* Format Pills */}
                  <div className="flex gap-2">
                    {report.formats.map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setSelectedFormats(prev => ({ ...prev, [report.id]: fmt }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase border-2 transition-colors ${
                          currentFormat === fmt
                            ? 'border-[#1D9E75] bg-[#1D9E75] text-white'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>

                  {/* Download */}
                  <button
                    onClick={() => handleDownload(report)}
                    disabled={downloading[`${report.id}-${currentFormat}`]}
                    className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors text-sm font-medium disabled:opacity-60"
                  >
                    {downloading[`${report.id}-${currentFormat}`]
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Download size={16} />}
                    Download {currentFormat.toUpperCase()}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Panel */}
        <div className="mt-8 bg-[#7F77DD]/5 border border-[#7F77DD]/20 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">About Exports</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>XLSX</strong> files include formatted sheets, headers, and color-coded scoring.</li>
            <li>• <strong>CSV</strong> files are flat exports suitable for data tools (Power BI, Google Sheets).</li>
            <li>• Reports include data only for records you have access to based on your role.</li>
            <li>• Large reports are streamed and may take a few seconds to start downloading.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
