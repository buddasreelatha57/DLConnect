CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(10) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    area VARCHAR(160) NOT NULL,
    role VARCHAR(16) NOT NULL,
    skill VARCHAR(80),
    business_name VARCHAR(160),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT users_role_check CHECK (role IN ('WORKER', 'EMPLOYER'))
);

CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    employer_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(100) NOT NULL,
    category VARCHAR(80) NOT NULL,
    job_type VARCHAR(24) NOT NULL,
    pay INTEGER NOT NULL CHECK (pay > 0),
    workers_needed INTEGER NOT NULL CHECK (workers_needed > 0),
    place VARCHAR(180) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT jobs_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT jobs_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE INDEX jobs_open_created_idx ON jobs (closed, created_at DESC);
CREATE INDEX jobs_coordinates_idx ON jobs (latitude, longitude);

CREATE TABLE applications (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    worker_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT applications_status_check CHECK (status IN ('APPLIED', 'ACCEPTED', 'REJECTED')),
    CONSTRAINT applications_job_worker_unique UNIQUE (job_id, worker_id)
);

CREATE INDEX applications_worker_created_idx ON applications (worker_id, created_at DESC);
CREATE INDEX applications_job_created_idx ON applications (job_id, created_at DESC);
