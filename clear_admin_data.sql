-- Clear admin/test data while preserving real accounts and core infrastructure
-- Preserved: real users (admin@metroflow.lgu, josiahraydevera0@gmail.com), road_nodes, road_edges, live_edge_states, rate_limit_counters
-- Deleted: vehicles, sensors, sensor_readings, hazard_zones, sos_requests, incident_reports, audit_logs, event_log, edge_advisories,
--          and junk/test users left over from pytest runs against this DB (mission-driver-*@example.test etc.) plus the
--          orphaned dispatcher@metroflow.local row (no longer the configured bootstrap admin)

BEGIN;

-- Delete in dependency order
DELETE FROM edge_advisories;
DELETE FROM sensor_readings;
DELETE FROM sensors;
DELETE FROM sos_requests;
DELETE FROM incident_reports;
DELETE FROM hazard_zones;
DELETE FROM vehicles;
DELETE FROM audit_logs;
DELETE FROM event_log;
DELETE FROM users
WHERE email NOT IN ('admin@metroflow.lgu', 'josiahraydevera0@gmail.com');

COMMIT;

-- Verification queries
SELECT 'Users (preserved): ' || COUNT(*) FROM users;
SELECT 'Road nodes (preserved): ' || COUNT(*) FROM road_nodes;
SELECT 'Road edges (preserved): ' || COUNT(*) FROM road_edges;
SELECT 'Vehicles (deleted): ' || COUNT(*) FROM vehicles;
SELECT 'Sensors (deleted): ' || COUNT(*) FROM sensors;
SELECT 'Sensor readings (deleted): ' || COUNT(*) FROM sensor_readings;
SELECT 'Hazard zones (deleted): ' || COUNT(*) FROM hazard_zones;
SELECT 'SOS requests (deleted): ' || COUNT(*) FROM sos_requests;
SELECT 'Incident reports (deleted): ' || COUNT(*) FROM incident_reports;
SELECT 'Audit logs (deleted): ' || COUNT(*) FROM audit_logs;
SELECT 'Event logs (deleted): ' || COUNT(*) FROM event_log;
SELECT 'Edge advisories (deleted): ' || COUNT(*) FROM edge_advisories;
