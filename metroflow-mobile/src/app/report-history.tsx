import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, CheckCircle2, Clock, FileWarning, RotateCcw, XCircle } from 'lucide-react-native';

import { ApiError, listMyReports, type MyReport } from '../api';
import { colors } from '../theme';

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; Icon: typeof Clock }> = {
  PENDING: { label: 'Pending review', color: colors.amber800, bg: colors.amber100, Icon: Clock },
  VERIFIED: { label: 'Verified', color: colors.green700, bg: '#f0fdf4', Icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: colors.red700, bg: colors.red50, Icon: XCircle },
  DUPLICATE: { label: 'Duplicate', color: colors.slate600, bg: colors.slate100, Icon: FileWarning },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ReportHistoryScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setReports(await listMyReports());
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load your reports.');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listMyReports();
        setReports(rows);
        setError(null);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Could not load your reports.');
      }
    })();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const verified = reports?.filter((r) => r.status === 'VERIFIED').length ?? 0;
  const rejected = reports?.filter((r) => r.status === 'REJECTED').length ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.slate50 }}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.slate100 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50, borderRadius: 10, borderWidth: 1, borderColor: colors.slate200 }}>
          <ArrowLeft size={18} color={colors.slate800} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.slate900 }}>My Reports</Text>
      </View>

      {reports && reports.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 0 }}>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.slate200, padding: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.slate900 }}>{reports.length}</Text>
            <Text style={{ fontSize: 10, color: colors.slate400 }}>Total</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.slate200, padding: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.green700 }}>{verified}</Text>
            <Text style={{ fontSize: 10, color: colors.slate400 }}>Verified</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.slate200, padding: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.red700 }}>{rejected}</Text>
            <Text style={{ fontSize: 10, color: colors.slate400 }}>Rejected</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
        {!reports && !error ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.blue600} />
          </View>
        ) : error ? (
          <View style={{ backgroundColor: colors.red50, borderRadius: 12, padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 12, color: colors.red700 }}>{error}</Text>
            <TouchableOpacity onPress={() => void load()}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.red700 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : reports!.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center', gap: 8 }}>
            <Camera size={28} color={colors.slate300} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.slate700 }}>
              No reports yet
            </Text>
            <Text style={{ fontSize: 11, color: colors.slate400 }}>
              Field reports you submit will show up here.
            </Text>
          </View>
        ) : (
          reports!.map((report) => {
            const status = STATUS_STYLE[report.status] ?? STATUS_STYLE.PENDING;
            const StatusIcon = status.Icon;
            return (
              <View
                key={report.report_id}
                style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.slate200, padding: 14, gap: 8 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.slate900 }}>
                    {report.depth_label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: status.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <StatusIcon size={11} color={status.color} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: status.color }}>{status.label}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: colors.slate500 }}>
                  {formatDate(report.submitted_at)}
                  {report.barangay ? ` • ${report.barangay}` : ''}
                </Text>
                {report.narrative ? (
                  <Text style={{ fontSize: 12, color: colors.slate700 }} numberOfLines={2}>
                    {report.narrative}
                  </Text>
                ) : null}
                {report.status === 'REJECTED' && report.decision_reason ? (
                  <Text style={{ fontSize: 11, color: colors.red700, fontStyle: 'italic' }}>
                    {report.decision_reason}
                  </Text>
                ) : null}
                {report.status === 'REJECTED' ? (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)/report',
                        params: {
                          resubmitDepth: report.depth_level,
                          resubmitNarrative: report.narrative ?? '',
                          resubmitBarangay: report.barangay ?? '',
                        },
                      })
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 }}
                  >
                    <RotateCcw size={12} color={colors.blue600} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.blue600 }}>
                      Report again
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
