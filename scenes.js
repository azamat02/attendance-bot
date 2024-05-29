import {Markup, Scenes} from "telegraf";
import {
    createUser,
    deleteUser,
    getCompleteWeeklyAttendanceByUserId, getMonthlyAttendance, getMonthlyAttendanceByUserId,
    getOfficeLocation,
    getTodaysAttendance,
    getTodaysAttendanceByUserId,
    getUserAttendanceToday,
    getUsers, getWeeklyAttendance,
    hasUserMarkedAttendanceToday,
    isUserRegistered,
    markAttendance,
    markLeavingTime,
    updateOfficeLocation
} from "./store/functions.js";
import moment from "moment";
import * as xlsx from "xlsx";

// Function to format date-time from database
function formatTime(dateTime) {
    if (dateTime) {
        return moment(dateTime).format('HH:mm')
    }
    return ' 🚫'
}

function getDatesInRange(startDate, endDate) {
    const dates = [];
    let currentDate = startDate.clone();

    while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
        dates.push(currentDate.clone());
        currentDate.add(1, 'days');
    }

    return dates;
}

export async function generateAttendanceExcel(period) {
    const users = await getUsers();
    let attendanceData = [];
    let startDate, endDate, filePath;

    if (period === 'week') {
        attendanceData = await getWeeklyAttendance();
        startDate = moment().startOf('week');
        endDate = moment().endOf('week');
        filePath = `attendance_week_${moment().format('YYYY-MM-DD')}.xlsx`;
    } else if (period === 'month') {
        attendanceData = await getMonthlyAttendance();
        startDate = moment().startOf('month');
        endDate = moment().endOf('month');
        filePath = `attendance_month_${moment().format('YYYY-MM-DD')}.xlsx`;
    }

    const dates = getDatesInRange(startDate, endDate);
    const data = [['Дата']];

    users.forEach(user => {
        data[0].push(`${user.fullname} - Пришел`, `${user.fullname} - Ушел`, `${user.fullname} - Причина`);
    });

    dates.forEach(date => {
        const row = [date.format('YYYY-MM-DD')];

        users.forEach(user => {
            const attendance = attendanceData.find(att => att.id === user.id && moment(att.comingtime).isSame(date, 'day'));
            row.push(
                attendance ? formatTime(attendance.comingtime) : '🚫',
                attendance ? formatTime(attendance.leavingtime) : '🚫',
                attendance ? attendance.reason || 'В офисе' : '🚫'
            );
        });

        data.push(row);
    });

    const worksheet = xlsx.utils.aoa_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Attendance');

    xlsx.writeFile(workbook, filePath);

    console.log(`Attendance report saved to ${filePath}`);
    return filePath;
}

async function generateTodaysAttendanceExcel() {
    const attendanceForToday = await getTodaysAttendance();

    const data = attendanceForToday.map((attendance) => ({
        "Сотрудник": attendance.fullname,
        'Пришел': formatTime(attendance.comingtime),
        'Ушел': formatTime(attendance.leavingtime),
        'Причина': attendance.reason ? attendance.reason : 'В офисе'
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Attendance');

    const filePath = `attendance_today_${new Date().toISOString().slice(0, 10)}.xlsx`;
    xlsx.writeFile(workbook, filePath);

    console.log(`Attendance report saved to ${filePath}`);
    return filePath;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    let R = 6371; // Radius of the earth in km
    let dLat = deg2rad(lat2-lat1);  // deg2rad below
    let dLon = deg2rad(lon2-lon1);
    let a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    let d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180)
}

function getAllDaysOfMonth(year, month) {
    const dates = [];
    const date = new Date(year, month, 1);

    while (date.getMonth() === month) {
        dates.push(new Date(date));  // Add a new Date object to the array
        date.setDate(date.getDate() + 1);  // Increment the day
    }

    return dates;
}

function formatWeekdayAttendance(attendanceRecords) {
    let response = `<pre>`;
    response += `-----------------------------------------\n`;
    response += `| День недели | Пришел | Ушел | Причина |\n`;
    response += `-----------------------------------------\n`;

    const daysOfWeekMap = {
        'Monday': 'Понедельник',
        'Tuesday': 'Вторник',
        'Wednesday': 'Среда',
        'Thursday': 'Четверг',
        'Friday': 'Пятница',
        'Saturday': 'Суббота',
        'Sunday': 'Воскресенье'
    };

    attendanceRecords.forEach(record => {
        const dayOfWeek = new Date(record.day).toLocaleDateString('ru-RU', { weekday: 'long' });
        const dayOfWeekRussian = daysOfWeekMap[dayOfWeek] || dayOfWeek;
        const arrived = record.comingTime ? formatTime(record.comingTime) : '  ➖  ';
        const left = record.leavingTime ? formatTime(record.leavingTime) : '  ➖  ';
        const reason = record.reason ? record.reason.padEnd(15, ' ') : 'В офисе';
        response += `| ${dayOfWeekRussian.padEnd(11)} | ${arrived.padEnd(5)} | ${left.padEnd(5)} | ${reason} |\n`;
        response += `-----------------------------------------\n`;
    });

    response += `</pre>`;
    return response;
}

function formatAttendanceRecords(attendanceRecords) {
    const allDays = getAllDaysOfMonth(new Date().getFullYear(), new Date().getMonth());
    let result = "<pre>";
    result += "-------------------------------------------------------------\n";
    result += "| Дата         | Пришел | Ушел | Количество часов | Причина |\n";
    result += "-------------------------------------------------------------\n";

    allDays.forEach(day => {
        const dayStr = day.toISOString().slice(0, 10);
        const record = attendanceRecords.find(r => {
            return new Date(r.comingtime).toISOString().slice(0, 10) === dayStr;
        });

        const date = day.toLocaleDateString('ru-RU');
        const timeIn = record && record.comingtime ? formatTime(record.comingtime) : '  ➖  ';
        const timeOut = record && record.leavingtime ? formatTime(record.leavingtime) : '  ➖  ';
        const reason = record && record.reason ? record.reason.padEnd(15, ' ') : 'В офисе';
        let totalHours = '  ➖  ';
        if (record && record.comingtime && record.leavingtime) {
            const diffMs = new Date(record.leavingtime) - new Date(record.comingtime);
            totalHours = (diffMs / 3600000).toFixed(2); // Convert milliseconds to hours, rounded to two decimals
        }

        result += `| ${date.padEnd(12)} | ${timeIn.padEnd(5)} | ${timeOut.padEnd(5)} | ${totalHours.padEnd(5)} |  ${reason}|\n`;
    });

    result += "----------------------------------------------------\n";
    result += "</pre>";
    return result;
}

export class UserScenesGenerator{
    UserButtons() {
        const userButtons = new Scenes.BaseScene("userButtons")

        userButtons.enter(async (ctx) => {
            await ctx.reply("Выберите действие: ", Markup.keyboard([
                ["Я пришел ✌️", "Я ухожу 👋"]
            ]))
        })

        userButtons.leave()

        return userButtons
    }

    MarkArrival() {
        const markArrival = new Scenes.BaseScene("markArrival")

        markArrival.enter(async (ctx) => {
            let isEmployee = await isUserRegistered(ctx.message.from.username)
            let isMarked = await hasUserMarkedAttendanceToday(ctx.message.from.username)

            if (isEmployee) {
                if (!isMarked) {
                    await ctx.reply("Вы сегодня не отмечались, отправьте свое местоположение для проверки или укажите, что вы не в офисе: ", Markup.keyboard([
                        Markup.button.locationRequest("Отправить местоположение"),
                        Markup.button.text("Я не в офисе")
                    ]).resize().oneTime())
                }
                if (isMarked) {
                    await ctx.reply("Вы уже отметились ✅")
                    await ctx.scene.enter("userButtons")
                }
            } else {
                await ctx.reply("Вы не являетесь сотрудником CodiPlay")
                await ctx.scene.leave()
            }
        })

        markArrival.on("location", async (ctx) => {
            const locations = await getOfficeLocation()
            const officeLatitude = locations.latitude
            const officeLongitude = locations.longitude
            const { latitude, longitude } = ctx.message.location
            let distance = getDistanceFromLatLonInKm(officeLatitude, officeLongitude, latitude, longitude) * 1000
            if (distance <= 100) {
                await markAttendance(ctx.message.from.username)
                await ctx.reply("Вы отметились ✅")
                await ctx.scene.enter("userButtons")
            } else {
                await ctx.reply("Вы далеко от офиса, повторите попытку когда будете в офисе 📍")
                await ctx.scene.enter("userButtons")
            }
        })

        markArrival.hears("Я не в офисе", async (ctx) => {
            await ctx.reply("Пожалуйста, укажите причину отсутствия:")
            ctx.session.awaitingReason = true
        })

        markArrival.on("text", async (ctx) => {
            if (ctx.session.awaitingReason) {
                const reason = ctx.message.text
                await markAttendance(ctx.message.from.username, reason)
                await ctx.reply(`Вы отметились с причиной: ${reason} ✅`)
                await ctx.scene.enter("userButtons")
                ctx.session.awaitingReason = false
            }
        })

        return markArrival
    }

    MarkLeaving() {
        const markLeaving = new Scenes.BaseScene("markLeaving")

        markLeaving.enter(async (ctx) => {
            let isEmployee = await isUserRegistered(ctx.message.from.username)

            let userAttendanceToday = await getUserAttendanceToday(ctx.message.from.username)

            if (isEmployee) {
                if (userAttendanceToday.length === 0) {
                    await ctx.reply("Вы не отмечались сегодня, сперва отметьте прибытие. ⚠️")
                }
                else if (userAttendanceToday[0]?.leavingtime) {
                    await ctx.reply("Вы уже отметили уход, спасибо, удачного Вам дня ✅")
                }
                else if (userAttendanceToday.length > 0) {
                    await markLeavingTime(ctx.message.from.username)
                    await ctx.reply("Вы отметили уход, спасибо, удачного Вам дня ✅")
                }
            } else {
                await ctx.reply("Вы не являетесь сотрудником CodiPlay")
            }
            await ctx.scene.enter("userButtons")
        })

        markLeaving.leave()

        return markLeaving
    }
}

export class AdminScenesGenerator{
    StatsForToday() {
        const statsForToday = new Scenes.BaseScene("statsForToday")

        statsForToday.enter(async (ctx) => {
            await ctx.reply("Статистика посещения сотрудников за сегодня");
            const attendanceForToday = await getTodaysAttendance();

            let res = `<pre>`;
            res += `----------------------------------------------------\n`;
            res += `| Сотрудник      | Пришел - Ушел            | Причина         |\n`;
            res += `----------------------------------------------------\n`;
            attendanceForToday.forEach((attendance) => {
                // Ensure time formatting handles null values
                const comingTime = attendance.comingtime ? formatTime(attendance.comingtime) : '➖';
                const leavingTime = attendance.leavingtime ? formatTime(attendance.leavingtime) : '➖';
                const name = attendance.fullname.padEnd(15, ' '); // Pad names to ensure alignment
                const reason = attendance.reason ? attendance.reason.padEnd(15, ' ') : 'В офисе';
                res += `| ${name} | 🕒 ${comingTime} - ${leavingTime} | ${reason} |\n`;
                res += `----------------------------------------------------\n`;
            });
            res += `</pre>`;

            await ctx.replyWithHTML(res);

            try {
                const filePath = await generateTodaysAttendanceExcel();
                await ctx.replyWithDocument({ source: filePath, filename: `attendance_today_${new Date().toISOString().slice(0, 10)}.xlsx` });
            } catch (err) {
                console.error('Error generating Excel file:', err);
                await ctx.reply('Ошибка при генерации отчета. Пожалуйста, попробуйте позже.');
            }

            // await ctx.replyWithHTML(res, Markup.inlineKeyboard([
            //     [Markup.button.url("Перейти на сайт", "https://vacancies-bot.web.app/?type=today")]
            // ]));
        });

        statsForToday.action("redirect", async (ctx) => {

        })

        return statsForToday
    }

    StartScreen() {
        const startScreen = new Scenes.BaseScene("startScreen")

        startScreen.enter(async (ctx) => {
            let keyboard = Markup.keyboard([
                "Я пришел ✌️",
                "Я ухожу 👋",
                "Определить зону офиса",
                "Статистика посещения за сегодня",
                "Статистика посещения за неделю",
                "Статистика посещения за месяц",
                "Список сотрудников",
                "Добавить сотрудника",
            ])
            await ctx.reply("Выберите действие: ", keyboard)
        })

        return startScreen
    }

    SetOfficeLocation() {
        const setOfficeLocation = new Scenes.BaseScene("setOfficeLocation")

        setOfficeLocation.enter(async (ctx) => {
            await ctx.replyWithHTML("Давайте определим зону офиса <b>(нажмите кнопку отправить местоположение)</b>\n⚠️Используйте телефон для отправки местоположения)⚠️", Markup.keyboard([
                Markup.button.locationRequest("Отправить местоположение")
            ]).resize().oneTime())
        })

        setOfficeLocation.on("location", async (ctx) => {
            const { latitude, longitude } = ctx.message.location
            await updateOfficeLocation(latitude, longitude)
            await ctx.reply("Зона офиса определена ✅")
            await ctx.reply("В последующем при отметки посещения, сотрудник должен находится в радиусе 10 метров с точки где вы определили зону офиса. 📍")
            await ctx.scene.enter("startScreen")
        })

        return setOfficeLocation
    }

    AddEmployee() {
        const addEmployee = new Scenes.BaseScene('addEmployee');

        addEmployee.enter(async (ctx) => {
            await ctx.replyWithPhoto({ source: "./assets/example2.png" }, Markup.removeKeyboard());
            await ctx.reply("Введите <b>username</b> пользователя (без @):", { parse_mode: "HTML" });
            ctx.session.employee = {};  // Initialize the session data store
        });

        addEmployee.on("text", async (ctx) => {
            if (!ctx.session.employee.username) {
                ctx.session.employee.username = ctx.message.text;
                await ctx.reply("Введите полное имя сотрудника:");
                return;  // Wait for the next piece of data
            } else if (!ctx.session.employee.fullname) {
                ctx.session.employee.fullname = ctx.message.text;
                await ctx.reply("Введите должность сотрудника:");
                return;  // Wait for the next piece of data
            } else if (!ctx.session.employee.position) {
                ctx.session.employee.position = ctx.message.text;
                sendDepartmentButtons(ctx);
                return;  // Transition to department selection
            }
        });

        addEmployee.action(/dept_.+/, async (ctx) => {
            const department = ctx.match[0].split('_')[1];
            ctx.session.employee.department = department;
            sendAdminButtons(ctx);
        });

        addEmployee.action(/admin_.+/, async (ctx) => {
            const isAdmin = ctx.match[0].split('_')[1] === 'yes';
            ctx.session.employee.isAdmin = isAdmin;
            await createUser(ctx.session.employee);  // Assume createEmployee function saves the employee data
            await ctx.reply("Сотрудник добавлен ✅");
            ctx.scene.enter('startScreen');
        });

        function sendDepartmentButtons(ctx) {
            const departments = [
                'Operation Team', 'Sales Team', 'Business Development & PR Team',
                'Education Development Team', 'Purchasing & Logistics Team', 'CodiPlay Squad', 'CodiTeach Squad'
            ];  // Example departments

            // Map each department to a button, each button in its own array to ensure it's on a new line
            const buttons = departments.map(dept => [Markup.button.callback(dept, `dept_${dept.replace(/ & /g, '_').replace(/ /g, '_').toLowerCase()}`)]);

            ctx.reply("Выберите отдел сотрудника:", Markup.inlineKeyboard(buttons));
        }

        function sendAdminButtons(ctx) {
            const buttons = [
                Markup.button.callback('Yes', 'admin_yes'),
                Markup.button.callback('No', 'admin_no')
            ];
            ctx.reply("Является ли сотрудник администратором?", Markup.inlineKeyboard(buttons));
        }

        return addEmployee;
    }

    ShowEmployees() {
        const showEmployees = new Scenes.BaseScene("showEmployees")

        showEmployees.enter(async (ctx) => {
            const employees = await getUsers()
            employees.forEach((employee) => {
                console.log(employee.fullname)
                ctx.reply(`${employee.fullname} | ADMIN ${employee.is_admin ? '✅' : '❌'}`, Markup.inlineKeyboard([
                    [Markup.button.callback("Посещаемость сотрудника за сегодня", JSON.stringify({action: "SFT", empId: employee.id, empName: employee.fullname}))],
                    [Markup.button.callback("Посещаемость сотрудника за неделю", JSON.stringify({action: "SFW", empId: employee.id, empName: employee.fullname}))],
                    [Markup.button.callback("Посещаемость сотрудника за месяц", JSON.stringify({action: "SFM", empId: employee.id, empName: employee.fullname}))],
                    [Markup.button.callback("Удалить сотрудника ❌", JSON.stringify({action: "D", empId: employee.id, empName: employee.fullname}))]
                ]))
            })

            if (employees.length === 0) {
                await ctx.replyWithHTML("Нету добавленных сотрудников")
            }
        })

        showEmployees.on("callback_query", async (ctx) => {
            const data = JSON.parse(ctx.callbackQuery.data)
            if (data.action === "D") {
                await deleteUser(data.empId)
                await ctx.reply("Сотрудник удален ✅")
                await ctx.scene.enter("startScreen")
            }
            if (data.action === "SFT") {
                const todayStats = await getTodaysAttendanceByUserId(data.empId)
                const comingTime = todayStats?.comingtime ? formatTime(todayStats.comingtime) : '➖';
                const leavingTime = todayStats?.leavingtime ? formatTime(todayStats.leavingtime) : '➖';

                let res = `<pre>`;
                const reason = todayStats.reason ? todayStats.reason.padEnd(15, ' ') : 'В офисе';

                res += `----------------------------------------------------\n`;
                res += `| Сотрудник      | Пришел - Ушел            | Причина         |\n`;
                res += `----------------------------------------------------\n`;
                res += `| ${data.empName} | 🕒 ${comingTime} - ${leavingTime} | ${reason} |\n`;
                res += `----------------------------------------------------\n`;
                res += `</pre>`;

                ctx.replyWithHTML(res)
            }
            if (data.action === "SFW") {
                const weeklyAttendance = await getCompleteWeeklyAttendanceByUserId(data.empId)
                const renderedData = formatWeekdayAttendance(weeklyAttendance)
                await ctx.replyWithHTML(renderedData)
            }
            if (data.action === "SFM") {
                const attendance = await getMonthlyAttendanceByUserId(data.empId)
                const renderedData = formatAttendanceRecords(attendance)
                await ctx.replyWithHTML(renderedData)
            }
        })

        return showEmployees
    }

    ShowAdmins() {
        const showAdmins = new Scenes.BaseScene("showAdmins")
        showAdmins.enter(async (ctx) => {
            const admins = await getAdmins()
            admins.forEach((admin) => {
                ctx.reply(admin.username, Markup.inlineKeyboard([
                    Markup.button.callback("Удалить админа ❌", admin.id)
                ]))
            })
        })
        showAdmins.on("callback_query", async (ctx) => {
            await deleteAdmin(ctx.callbackQuery.data)
            await ctx.reply("Администратор удален ✅")
            await ctx.scene.enter("startScreen")
        })
        return showAdmins
    }

    AddAdmin() {
        const addAdmin = new Scenes.BaseScene("addAdmin")
        addAdmin.enter(async (ctx) => {
            await ctx.replyWithPhoto({source: "./assets/example2.png"}, Markup.removeKeyboard())
            await ctx.reply("Введите <b>username</b> пользователя (без @): ", {parse_mode: "HTML"})
        })
        addAdmin.on("text", async (ctx) => {
            let admin = {
                username: ctx.message.text
            }
            await createAdmin(admin)
            await ctx.reply("Администратор добавлен ✅")
            await ctx.scene.enter("startScreen")
        })
        return addAdmin
    }
}