-- Skema PostGIS untuk PDAM Semarang
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    subdistrict TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'normal',
    priority_score INTEGER DEFAULT 0,
    geom geometry(POLYGON, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
    kelurahan TEXT,
    report_type TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'baru',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdam_points (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    geom geometry(Point, 4326) NOT NULL
);

INSERT INTO areas (name, district, subdistrict, status, priority_score, geom)
VALUES
  ('Semarang Barat', 'Semarang Barat', 'Pondok Candra', 'normal', 45,
   ST_GeomFromText('POLYGON((110.366 0.750, 110.368 0.750, 110.368 0.752, 110.366 0.752, 110.366 0.750))', 4326)),
  ('Semarang Selatan', 'Semarang Selatan', 'Pedalangan', 'normal', 60,
   ST_GeomFromText('POLYGON((110.412 0.699, 110.414 0.699, 110.414 0.701, 110.412 0.701, 110.412 0.699))', 4326)),
  ('Semarang Timur', 'Semarang Timur', 'Tlogosari', 'normal', 55,
   ST_GeomFromText('POLYGON((110.444 0.725, 110.446 0.725, 110.446 0.727, 110.444 0.727, 110.444 0.725))', 4326));
