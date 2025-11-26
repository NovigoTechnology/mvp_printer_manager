-- Insertar datos de prueba para los últimos 7 días
INSERT INTO medical_printer_counters (printer_id, timestamp, total_printed, total_available, total_trays_loaded, raw_data, is_online) VALUES 
(227, NOW() - INTERVAL '1 day', 98, 102, 2, '{"TRAY A": {"available": 52, "printed": 48}, "TRAY B": {"available": 50, "printed": 50}}', true),
(227, NOW() - INTERVAL '2 days', 195, 105, 2, '{"TRAY A": {"available": 55, "printed": 95}, "TRAY B": {"available": 50, "printed": 100}}', true),
(227, NOW() - INTERVAL '3 days', 280, 120, 2, '{"TRAY A": {"available": 60, "printed": 140}, "TRAY B": {"available": 60, "printed": 140}}', true),
(227, NOW() - INTERVAL '4 days', 350, 150, 2, '{"TRAY A": {"available": 75, "printed": 175}, "TRAY B": {"available": 75, "printed": 175}}', true),
(227, NOW() - INTERVAL '5 days', 420, 180, 2, '{"TRAY A": {"available": 90, "printed": 210}, "TRAY B": {"available": 90, "printed": 210}}', true),
(227, NOW() - INTERVAL '6 days', 490, 210, 2, '{"TRAY A": {"available": 105, "printed": 245}, "TRAY B": {"available": 105, "printed": 245}}', true),
(227, NOW() - INTERVAL '7 days', 560, 240, 2, '{"TRAY A": {"available": 120, "printed": 280}, "TRAY B": {"available": 120, "printed": 280}}', true);
