-- Create table "users"
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    position VARCHAR(255),
    department VARCHAR(255),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create table "attendance"
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    comingTime TIMESTAMP NOT NULL,
    leavingTime TIMESTAMP,
    reason VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create table "officeLocation"
CREATE TABLE officeLocation (
    id INT PRIMARY KEY DEFAULT 1,
    latitude DECIMAL NOT NULL,
    longitude DECIMAL NOT NULL
);

-- Insert a default record into "officeLocation"
-- The unique primary key ensures only one record can exist
INSERT INTO officeLocation (latitude, longitude)
VALUES (0.0, 0.0)
ON CONFLICT (id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

INSERT INTO users (fullname, username, position, department, is_admin)
VALUES ('Azamat Saiduly', 'tolegenv', 'developer', 'CodiTeach Squad', true)