import pkg from 'pg'

const { Pool } = pkg

// Create a new pool instance to manage your database connections

const pool = new Pool({
    user: 'main',
    host: 'postgres',
    database: 'cp',
    password: 'Azamat2341!',
    port: 5432,
});

export async function isUserAdmin(username) {
    try {
        // Query to select the is_admin column where the username matches
        const query = 'SELECT is_admin FROM users WHERE username = $1';
        const values = [username];

        // Execute the query
        const res = await pool.query(query, values);

        // Check if we got a result and return the is_admin value
        if (res.rows.length > 0) {
            return res.rows[0].is_admin;
        }

        // Return false if no user is found
        return false;
    } catch (err) {
        console.error('Error executing isUserAdmin:', err);
        throw err;
    }
}

export async function isUserRegistered(username) {
    try {
        const query = 'SELECT 1 FROM users WHERE username = $1';
        const res = await pool.query(query, [username]);

        // If the query returns at least one row, the user is registered
        return res.rows.length > 0;
    } catch (err) {
        console.error('Error querying database:', err);
        throw err;  // Re-throw the error for caller to handle
    }
}

export async function getUserAttendanceToday(username){
    try {
        const query = `
            SELECT * FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE u.username = $1 AND DATE(a.comingTime) = CURRENT_DATE
        `;
        const res = await pool.query(query, [username]);

        // If the query returns at least one row, the user has marked attendance today
        return res.rows;
    } catch (err) {
        console.error('Error querying database for attendance:', err);
        throw err;  // Re-throw the error for caller to handle
    }
}

export async function hasUserMarkedAttendanceToday(username) {
    try {
        const query = `
            SELECT 1 FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE u.username = $1 AND DATE(a.comingTime) = CURRENT_DATE
        `;
        const res = await pool.query(query, [username]);

        // If the query returns at least one row, the user has marked attendance today
        return res.rows.length > 0;
    } catch (err) {
        console.error('Error querying database for attendance:', err);
        throw err;  // Re-throw the error for caller to handle
    }
}

export async function markAttendance(username) {
    try {
        // Start a transaction to ensure data consistency
        await pool.query('BEGIN');

        // Get the user ID from the users table
        const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userRes.rows.length === 0) {
            throw new Error('User not found');
        }
        const userId = userRes.rows[0].id;

        // Insert a new attendance record for today
        const attendanceRes = await pool.query('INSERT INTO attendance (user_id, comingTime) VALUES ($1, NOW())', [userId]);

        // Commit the transaction
        await pool.query('END');

        return true;
    } catch (err) {
        // Rollback the transaction on error
        await pool.query('ROLLBACK');
        console.error('Failed to mark attendance:', err);
        throw err;
    }
}

export async function markLeavingTime(username) {
    try {
        // Start a transaction to ensure data consistency
        await pool.query('BEGIN');

        // Get the user ID from the users table
        const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userRes.rows.length === 0) {
            throw new Error('User not found');
        }
        const userId = userRes.rows[0].id;

        // Update the latest attendance record for this user by setting the leaving time to NOW()
        const updateRes = await pool.query(
            `UPDATE attendance SET leavingTime = NOW() WHERE user_id = $1 AND id = (
                SELECT MAX(id) FROM attendance WHERE user_id = $1 AND leavingTime IS NULL
            ) RETURNING id;`,
            [userId]
        );

        // If no rows were updated, throw an error
        if (updateRes.rowCount === 0) {
            throw new Error('Leaving time not marked, no eligible attendance record found');
        }

        // Commit the transaction
        await pool.query('END');
        return true;
    } catch (err) {
        // Rollback the transaction on error
        await pool.query('ROLLBACK');
        console.error('Failed to mark leaving time:', err);
        throw err;
    }
}

export async function getOfficeLocation() {
    try {
        const query = 'SELECT latitude, longitude FROM officeLocation WHERE id = 1';
        const res = await pool.query(query);

        if (res.rows.length === 0) {
            throw new Error('Location not found');
        }

        return res.rows[0];  // Return the first row which should be the only row
    } catch (err) {
        console.error('Error querying location from database:', err);
        throw err;
    }
}

export async function updateOfficeLocation(latitude, longitude) {
    try {
        const query = `
            UPDATE officeLocation
            SET latitude = $1, longitude = $2
            WHERE id = 1;
        `;
        const res = await pool.query(query, [latitude, longitude]);

        if (res.rowCount === 0) {
            // Handle the case where no rows were updated (though there should always be one row).
            throw new Error('No rows updated, check if initial record exists.');
        }

        return true;  // Indicate success if row was updated
    } catch (err) {
        console.error('Error updating office location:', err);
        throw err;  // Re-throw the error for caller to handle
    }
}

export async function getTodaysAttendance() {
    try {
        const today = new Date();
        const todayString = today.toISOString().slice(0, 10); // Converts date to YYYY-MM-DD format

        const query = `
            SELECT 
                u.username, 
                u.fullname, 
                u.position, 
                u.department, 
                a.comingTime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Almaty' as comingTime, 
                a.leavingTime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Almaty' as leavingTime
            FROM 
                users u
            LEFT JOIN 
                attendance a ON u.id = a.user_id AND DATE(a.comingTime AT TIME ZONE 'Asia/Almaty') = $1
            ORDER BY 
                u.username;
        `;
        const res = await pool.query(query, [todayString]);

        return res.rows;
    } catch (err) {
        console.error('Error querying today\'s attendance:', err);
        throw err;
    }
}

export async function createUser({username, fullname, position, department, isAdmin = false}) {
    const query = `
        INSERT INTO users (username, fullname, position, department, is_admin)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
    `;

    try {
        const res = await pool.query(query, [username, fullname, position, department, isAdmin]);
        console.log(`User created with ID: ${res.rows[0].id}`);
        return true;
    } catch (err) {
        console.error('Error creating user:', err.detail);
        throw err;
    }
}

export async function getUsers() {
    try {
        const res = await pool.query('SELECT * FROM users ORDER BY id ASC');
        return res.rows;  // Each row is a user object
    } catch (err) {
        console.error('Failed to retrieve users:', err);
        throw err;
    }
}

export async function deleteUser(userId) {
    const query = 'DELETE FROM users WHERE id = $1';

    try {
        const res = await pool.query(query, [userId]);
        if (res.rowCount === 0) {
            console.error('No user found with ID:', userId);
            return false; // No user found with the given ID
        }
        return true; // User deletion was successful
    } catch (err) {
        console.error('Failed to delete user:', err);
        throw err;
    }
}

export async function getTodaysAttendanceByUserId(userId) {
    const today = new Date();
    const todayString = today.toISOString().slice(0, 10); // Converts date to YYYY-MM-DD format

    const query = `
        SELECT 
            id, 
            user_id, 
            comingTime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Almaty' as comingTime, 
            leavingTime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Almaty' as leavingTime
        FROM 
            attendance
        WHERE 
            user_id = $1 
            AND DATE(comingTime AT TIME ZONE 'Asia/Almaty') = $2
    `;
    try {
        const res = await pool.query(query, [userId, todayString]);
        console.log(res.rows)
        if (res.rows.length === 0) {
            console.log('No attendance record for today found for user ID:', userId);
            return null;  // Explicitly return null to indicate no data found
        }
        return res.rows[0];  // Return the first matching record
    } catch (err) {
        console.error("Failed to retrieve today's attendance for user:", err);
        throw err;
    }
}

export async function getCompleteWeeklyAttendanceByUserId(userId) {
    const today = new Date();
    let startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // Adjust to set your week start (1 for Monday)
    startOfWeek.setHours(0, 0, 0, 0);

    const daysOfWeek = Array.from({ length: 7 }).map((_, i) => {
        const day = new Date(startOfWeek);
        day.setDate(day.getDate() + i);
        return day;
    });

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const query = `
        SELECT 
            id, 
            user_id, 
            comingTime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Almaty' AS comingTime, 
            leavingTime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Almaty' AS leavingTime
        FROM 
            attendance
        WHERE 
            user_id = $1 
            AND DATE(comingTime AT TIME ZONE 'Asia/Almaty') >= $2 
            AND DATE(comingTime AT TIME ZONE 'Asia/Almaty') < $3
        ORDER BY 
            comingTime ASC;
    `;
    try {
        const res = await pool.query(query, [userId, startOfWeek, endOfWeek]);
        const attendanceRecords = res.rows;

        // Map results to include all days of the week
        const weeklyAttendance = daysOfWeek.map(day => {
            const record = attendanceRecords.find(record => {
                if (record.comingtime) {
                    const recordDate = new Date(record.comingtime);
                    return recordDate.toISOString().slice(0, 10) === day.toISOString().slice(0, 10);
                }
                return false;
            });

            return {
                user_id: userId,
                day: day.toISOString().slice(0, 10),
                comingTime: record?.comingtime || null,
                leavingTime: record?.leavingtime || null,
                status: 'No attendance'
            };
        });

        return weeklyAttendance;
    } catch (err) {
        console.error('Failed to retrieve weekly attendance for user:', err);
        throw err;
    }
}

export async function getMonthlyAttendanceByUserId(userId) {
    const today = new Date();
    // Convert start and end of the month to 'Asia/Almaty' timezone
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    const query = `
        SELECT 
            id, 
            user_id, 
            comingTime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Almaty' AS comingTime, 
            leavingTime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Almaty' AS leavingTime
        FROM 
            attendance
        WHERE 
            user_id = $1 
            AND DATE(comingTime AT TIME ZONE 'Asia/Almaty') BETWEEN $2 AND $3
        ORDER BY 
            comingTime ASC;
    `;
    try {
        const res = await pool.query(query, [userId, firstDayOfMonth, lastDayOfMonth]);
        return res.rows;  // Array of attendance records for the current month
    } catch (err) {
        console.error('Failed to retrieve monthly attendance for user:', err);
        throw err;
    }
}