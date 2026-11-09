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
import { ArrowLeft, Camera, CheckCircle2, ChevronDown, ChevronUp, Clock, FileWarning, RotateCcw, XCircle } from 'lucide-react-native';

import { ApiError, listMyReports, type MyReport } from '../api';
import { fontSize, space, colors } from '../theme';

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; Icon: typeof Clock }> = {
  PENDING: { label: 'Pending review', color: colors.amber800, bg: colors.amber100, Icon: Clock },
  VERIFIED: { label: 'Verified', color: colors.green700, bg: colors.green50, Icon: CheckCircle2 },
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12], paddingHorizontal: space[16], paddingVertical: space[14], backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.slate100 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50, borderRadius: 10, borderWidth: 1, borderColor: colors.slate200 }}>
          <ArrowLeft size={18} color={colors.slate800} />
        </TouchableOpacity>
        <Text style={{ fontSize: fontSize.subtitle, fontWeight: '800', color: colors.slate900 }}>My Reports</Text>
      </View>

      {reports && reports.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: space[8], padding: space[16], paddingBottom: space[0] }}>
          <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.slate200, padding: space[12], alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: colors.slate900 }}>{reports.length}</Text>
            <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Total</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.slate200, padding: space[12], alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: colors.green700 }}>{verified}</Text>
            <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Verified</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.slate200, padding: space[12], alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.title, fontWeight: '800', color: colors.red700 }}>{rejected}</Text>
            <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>Rejected</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space[16], gap: space[10] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
        {!reports && !error ? (
          <View style={{ paddingVertical: space[60], alignItems: 'center' }}>
            <ActivityIndicator color={colors.blue600} />
          </View>
        ) : error ? (
          <View style={{ backgroundColor: colors.red50, borderRadius: 12, padding: space[16], gap: space[8] }}>
            <Text style={{ fontSize: fontSize.body, color: colors.red700 }}>{error}</Text>
            <TouchableOpacity onPress={() => void load()}>
              <Text style={{ fontSize: fontSize.body, fontWeight: '700', color: colors.red700 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : reports!.length === 0 ? (
          <View style={{ paddingVertical: space[60], alignItems: 'center', gap: space[8] }}>
            <Camera size={28} color={colors.slate300} />
            <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: colors.slate700 }}>
              No reports yet
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.slate400 }}>
              Field reports you submit will show up here.
            </Text>
          </View>
        ) : (
          reports!.map((report) => {
            const status = STATUS_STYLE[report.status] ?? STATUS_STYLE.PENDING;
            const StatusIcon = status.Icon;
            const expanded = expandedId === report.report_id;
            return (
              <TouchableOpacity
                key={report.report_id}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={`Report details: ${report.depth_label}, ${status.label}`}
                onPress={() => setExpandedId(expanded ? null : report.report_id)}
                style={{ backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.slate200, padding: space[14], gap: space[8] }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: fontSize.label, fontWeight: '700', color: colors.slate900 }}>
                    {report.depth_label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], backgroundColor: status.bg, paddingHorizontal: space[8], paddingVertical: space[3], borderRadius: 999 }}>
                      <StatusIcon size={11} color={status.color} />
                      <Text style={{ fontSize: fontSize.micro, fontWeight: '700', color: status.color }}>{status.label}</Text>
                    </View>
                    {expanded ? (
                      <ChevronUp size={14} color={colors.slate400} />
                    ) : (
                      <ChevronDown size={14} color={colors.slate400} />
                    )}
                  </View>
                </View>
                <Text style={{ fontSize: fontSize.caption, color: colors.slate500 }}>
                  {formatDate(report.submitted_at)}
                  {report.barangay ? ` • ${report.barangay}` : ''}
                </Text>
                {report.narrative ? (
                  <Text style={{ fontSize: fontSize.body, color: colors.slate700 }} numberOfLines={expanded ? undefined : 2}>
                    {report.narrative}
                  </Text>
                ) : null}
                {expanded ? (
                  <View style={{ borderTopWidth: 1, borderColor: colors.slate100, paddingTop: space[8], gap: space[4] }}>
                    <Text style={{ fontSize: fontSize.micro, color: colors.slate400 }}>
                      Captured {formatDate(report.captured_at)} • Submitted {formatDate(report.submitted_at)}
                    </Text>
                    <Text style={{ fontSize: fontSize.micro, color: colors.slate300 }}>ID {report.report_id}</Text>
                  </View>
                ) : null}
                {report.status === 'REJECTED' && report.decision_reason ? (
                  <Text style={{ fontSize: fontSize.caption, color: colors.red700, fontStyle: 'italic' }}>
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
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space[6], alignSelf: 'flex-start', marginTop: space[2] }}
                  >
                    <RotateCcw size={12} color={colors.blue600} />
                    <Text style={{ fontSize: fontSize.caption, fontWeight: '700', color: colors.blue600 }}>
                      Report again
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
