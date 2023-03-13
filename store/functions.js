import {addDoc, setDoc, collection, getDocs, deleteDoc, doc} from "firebase/firestore";
import {db} from "./firebase.js";

export async function getAdmins() {
    const adminsCol = collection(db, 'attendanceAdmins');
    const adminsSnapshot = await getDocs(adminsCol);
    const adminsList = adminsSnapshot.docs.map(doc => {
        return {
            id: doc.id,
            ...doc.data()
        }
    });
    return adminsList;
}

export async function createAdmin(admin) {
    const dbRef = collection(db, "attendanceAdmins");
    await addDoc(dbRef, admin).then(docRef => {
        console.log("Admin added!")
    })
}

export async function deleteAdmin(id) {
    await deleteDoc(doc(db, "attendanceAdmins", id));
}

export async function updateAdmin(admin) {
    await setDoc(doc(db, "attendanceAdmins", admin.id), admin);
}

export async function getEmployees() {
    const employeesCol = collection(db, 'employees');
    const employeesSnapshot = await getDocs(employeesCol);
    const employeesList = employeesSnapshot.docs.map(doc => {
        return {
            id: doc.id,
            ...doc.data()
        }
    });
    return employeesList;
}

export async function createEmployee(employee) {
    const dbRef = collection(db, "employees");
    await addDoc(dbRef, employee).then(docRef => {
        console.log("Employee added!")
    })
}

export async function createOfficeLocation(location) {
    const dbRef = collection(db, "officeLocation");
    await addDoc(dbRef, location).then(docRef => {
        console.log("Office location added!")
    })
}

export async function getAttendance() {
    const attendanceCol = collection(db, 'attendance');
    const attendanceSnapshot = await getDocs(attendanceCol);
    const attendanceList = attendanceSnapshot.docs.map(doc => {
        return {
            id: doc.id,
            ...doc.data()
        }
    });
    return attendanceList;
}

export async function getOfficeLocation() {
    const locationsCol = collection(db, 'officeLocation');
    const locationsSnapshot = await getDocs(locationsCol);
    const locationsList = locationsSnapshot.docs.map(doc => {
        return {
            id: doc.id,
            ...doc.data()
        }
    });
    return locationsList;
}

export async function markAttendance(data) {
    const dbRef = collection(db, "attendance");
    await addDoc(dbRef, data).then(docRef => {
        console.log("Attendance marked!")
    })
}

export async function markLeavingAttendance(attendance) {
    await setDoc(doc(db, "attendance", attendance.id), attendance);
}
