import {Markup, Scenes} from "telegraf";
import {
    createAdmin,
    createEmployee,
    createOfficeLocation,
    deleteAdmin,
    deleteEmployee,
    getAdmins,
    getAttendance,
    getEmployees,
    getOfficeLocation,
    markAttendance,
    markLeavingAttendance
} from "./store/functions.js";

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function isMarkedToday(attendance, from) {
    let res = {
        isMarkedToday: false,
        attendance: []
    }
    const todayDate = new Date().toLocaleDateString()
    attendance.forEach(attendance => {
        if (from.username === attendance.user.username && +from.id === +attendance.user.id) {
            let comingTime = new Date(+attendance.comingTime.seconds * 1000).toLocaleDateString()
            if (comingTime === todayDate) {
                res.isMarkedToday = true
                res.attendance = attendance
            }
        }
    })
    return res
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

function getWeek() {
    let curr = new Date; // get current date
    let first = curr.getDate() - curr.getDay() + 1; // First day is the day of the month - the day of the week

    let firstWeekDayDate = new Date(curr.setDate(first))
    let workingWeek = [firstWeekDayDate]

    for (let i = 1; i<5; i++) {
        let weekDayDate = new Date(curr.setDate(first+i))
        workingWeek.push(weekDayDate)
    }

    return workingWeek
}

function getDaysInMonth(month, year) {
    let date = new Date(year, month, 1);
    let days = [];
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
}

function convertTimeStampDate(seconds) {
    return new Date(+seconds * 1000)
}

function getStatsForToday(employee, totalAttendanceList) {
    const todayDate = new Date().toLocaleDateString()
    const todayAttendance = totalAttendanceList.find((attendance) => {
        const comingDay = convertTimeStampDate(attendance.comingTime.seconds).toLocaleDateString()
        if (attendance.user.username === employee.username && comingDay === todayDate) {
            return attendance
        }
    })
    let result = {
        comingTime: "",
        leaveTime: "",
    }
    if (todayAttendance) {
        const comingTime = new Date((+todayAttendance.comingTime.seconds * 1000)).toLocaleTimeString();
        const leaveTime = todayAttendance.leavingTime ? new Date((+todayAttendance.leavingTime.seconds * 1000)).toLocaleTimeString() : '➖';
        result.comingTime = comingTime
        result.leaveTime = leaveTime
    } else {
        result.comingTime = "➖"
        result.leaveTime = "➖"
    }
    return result
}

function getStatsForWeek(employee, totalAttendanceList) {
    const weekDays = getWeek()
    const isWeekDay = (comingTime) => {
        return weekDays.map(day => day.toLocaleDateString()).indexOf(comingTime) !== -1
    }
    const userAttendanceList = totalAttendanceList.filter((attendance) => {
        const comingTime = convertTimeStampDate(attendance.comingTime.seconds).toLocaleDateString();
        if (attendance.user.username === employee.username && isWeekDay(comingTime)) {
            return attendance
        }
    })
    let res = `<pre>`
    res += `-------------------------------\n`
    res += `| День недели | Пришел | Ушел |\n`
    res += `-------------------------------\n`

    weekDays.forEach((day) => {
        let options = { weekday: 'short', day: 'numeric', month: 'numeric' }
        let dayHTML = capitalizeFirstLetter(day.toLocaleDateString("ru-RU", options).toString())

        const dayAttendance = userAttendanceList.find((attendance) => {
            let time = convertTimeStampDate(attendance.comingTime.seconds).toLocaleDateString()
            if(time === day.toLocaleDateString()) {
                return attendance
            }
        })
        const comingTime = dayAttendance?.comingTime ? convertTimeStampDate(dayAttendance?.comingTime?.seconds).toLocaleTimeString('ru-RU', {hour: "numeric", minute: "numeric"}) : ' ➖ ';
        const leaveTime = dayAttendance?.leavingTime ? convertTimeStampDate(dayAttendance?.leavingTime?.seconds).toLocaleTimeString('ru-RU', {hour: "numeric", minute: "numeric"}) : ' ➖ ';

        res += `| ${dayHTML}   | ${comingTime} | ${leaveTime} |\n`
        res += `-------------------------------\n`
    })
    res += `</pre>`
    return res
}

function getStatsForMonth(employee, totalAttendanceList) {
    const monthDays = getDaysInMonth(new Date().getMonth(), new Date().getFullYear())
    const isMonthDay = (comingTime) => {
        return monthDays.map(day => day.toLocaleDateString()).indexOf(comingTime) !== -1
    }
    const userAttendanceList = totalAttendanceList.filter((attendance) => {
        const comingTime = convertTimeStampDate(attendance.comingTime.seconds).toLocaleDateString();
        if (attendance.user.username === employee.username && isMonthDay(comingTime)) {
            return attendance
        }
    })
    let res = `<pre>`
    res += `-------------------------------\n`
    res += `|     Дата    | Пришел | Ушел |\n`
    res += `-------------------------------\n`

    monthDays.forEach((day) => {
        let options = { weekday: 'short', day: 'numeric', month: 'numeric' }
        let dayHTML = capitalizeFirstLetter(day.toLocaleDateString("ru-RU", options).toString())

        const dayAttendance = userAttendanceList.find((attendance) => {
            let time = convertTimeStampDate(attendance.comingTime.seconds).toLocaleDateString()
            if(time === day.toLocaleDateString()) {
                return attendance
            }
        })
        const comingTime = dayAttendance?.comingTime ? convertTimeStampDate(dayAttendance?.comingTime?.seconds).toLocaleTimeString('ru-RU', {hour: "numeric", minute: "numeric"}) : ' ➖ ';
        const leaveTime = dayAttendance?.leavingTime ? convertTimeStampDate(dayAttendance?.leavingTime?.seconds).toLocaleTimeString('ru-RU', {hour: "numeric", minute: "numeric"}) : ' ➖ ';

        res += `| ${dayHTML}   | ${comingTime} | ${leaveTime} |\n`
        res += `-------------------------------\n`
    })
    res += `</pre>`
    return res
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
            const employees = await getEmployees()
            let isEmployee = false
            let emp = {}
            employees.forEach((employee) => {
                if (employee.username === ctx.message.from.username) {
                    isEmployee = true
                    emp = employee
                }
            })

            let attendance = await getAttendance()
            let isMarked = isMarkedToday(attendance, ctx.message.from).isMarkedToday

            if (isEmployee) {
                if (!isMarked) {
                    await ctx.reply("Вы сегодня не отмечались, отправьте свое местоположение для проверки: ", Markup.keyboard([
                        Markup.button.locationRequest("Отправить местоположение")
                    ]).resize().oneTime())
                }
                if (isMarked) {
                    await ctx.reply("Вы уже отметились ✅")
                    await ctx.scene.enter("userButtons")
                }
            } else {
                await ctx.reply("Вы не являетесь сотрудником Сапа")
                await ctx.scene.leave()
            }
        })

        markArrival.on("location", async (ctx) => {
            const locations = await getOfficeLocation()
            const officeLatitude = locations[0].latitude
            const officeLongitude = locations[0].longitude
            const { latitude, longitude } = ctx.message.location
            let distance = getDistanceFromLatLonInKm(officeLatitude, officeLongitude, latitude, longitude) * 1000
            if (distance <= 10) {
                await markAttendance({
                    user: ctx.message.from,
                    comingTime: new Date()
                })
                await ctx.reply("Вы отметились ✅")
                await ctx.scene.enter("userButtons")

            } else {
                await ctx.reply("Вы далеко от офиса, повторите попытку когда будете в офисе 📍")
                await ctx.scene.enter("userButtons")
            }
        })

        return markArrival
    }

    MarkLeaving() {
        const markLeaving = new Scenes.BaseScene("markLeaving")

        markLeaving.enter(async (ctx) => {
            const employees = await getEmployees()
            let isEmployee = false
            let emp = {}
            employees.forEach((employee) => {
                if (employee.username === ctx.message.from.username) {
                    isEmployee = true
                    emp = employee
                }
            })

            let attendance = await getAttendance()
            let res = isMarkedToday(attendance, ctx.message.from)

            if (isEmployee) {
                if (!res.isMarkedToday) {
                    await ctx.reply("Вы не отмечались сегодня, сперва отметьте прибытие. ⚠️")
                }
                else if (res.attendance?.leavingTime) {
                    await ctx.reply("Вы уже отметили уход, спасибо, удачного Вам дня ✅")
                }
                else if (res.isMarkedToday) {
                    await markLeavingAttendance({
                        ...res.attendance,
                        leavingTime: new Date()
                    })
                    await ctx.reply("Вы отметили уход, спасибо, удачного Вам дня ✅")
                }
            } else {
                await ctx.reply("Вы не являетесь сотрудником Сапа")
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
            await ctx.reply("Статистика посещения сотрудников за сегодня")
            const employees = await getEmployees()
            const totalAttendanceList = await getAttendance()
            let res = `<pre>`
            res += `-------------------------------\n`
            res += `| Сотрудник | Пришел | Ушел |\n`
            res += `-------------------------------\n`
            employees.forEach((employee) => {
                let statForToday = getStatsForToday(employee, totalAttendanceList)
                let str = `| ${employee.username} | ${statForToday.comingTime} | ${statForToday.leaveTime} |`
                let length = str.length
                res += `${str}\n`
                for (let i = 0; i<=length; i++) {
                    res += `-`
                }
                res += '\n'

            })
            res += `</pre>`
            await ctx.replyWithHTML(res, Markup.inlineKeyboard([
                [Markup.button.url("Перейти на сайт", "https://vacancies-bot.web.app/?type=today")]
            ]))
        })

        statsForToday.action("redirect", async (ctx) => {

        })

        return statsForToday
    }

    StartScreen() {
        const startScreen = new Scenes.BaseScene("startScreen")

        startScreen.enter(async (ctx) => {
            let keyboard = Markup.keyboard([
                "Определить зону офиса",
                "Статистика посещения за сегодня",
                "Статистика посещения за неделю",
                "Статистика посещения за месяц",
                "Список администраторов",
                "Добавить админа",
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
            await createOfficeLocation({latitude, longitude})
            await ctx.reply("Зона офиса определена ✅")
            await ctx.reply("В последующем при отметки посещения, сотрудник должен находится в радиусе 10 метров с точки где вы определили зону офиса. 📍")
            await ctx.scene.enter("startScreen")
        })

        return setOfficeLocation
    }

    AddEmployee() {
        const addEmployee = new Scenes.BaseScene("addEmployee")
        addEmployee.enter(async (ctx) => {
            await ctx.replyWithPhoto({source: "./assets/example2.png"}, Markup.removeKeyboard())
            await ctx.reply("Введите <b>username</b> пользователя (без @): ", {parse_mode: "HTML"})
        })
        addEmployee.on("text", async (ctx) => {
            let employee = {
                username: ctx.message.text
            }
            await createEmployee(employee)
            await ctx.reply("Сотрудник добавлен ✅")
            await ctx.scene.enter("startScreen")
        })
        return addEmployee
    }

    ShowEmployees() {
        const showEmployees = new Scenes.BaseScene("showEmployees")

        showEmployees.enter(async (ctx) => {
            const employees = await getEmployees()
            employees.forEach((employee) => {
                ctx.reply(employee.username, Markup.inlineKeyboard([
                    [Markup.button.callback("Посещаемость сотрудника за сегодня", JSON.stringify({action: "statsForToday", empId: employee.id}))],
                    [Markup.button.callback("Посещаемость сотрудника за неделю", JSON.stringify({action: "statsForWeek", empId: employee.id}))],
                    [Markup.button.callback("Посещаемость сотрудника за месяц", JSON.stringify({action: "statsForMonth", empId: employee.id}))],
                    [Markup.button.callback("Удалить сотрудника ❌", JSON.stringify({action: "delete", empId: employee.id}))]
                ]))
            })
        })

        showEmployees.on("callback_query", async (ctx) => {
            const data = JSON.parse(ctx.callbackQuery.data)
            if (data.action === "delete") {
                await deleteEmployee(data.id)
                await ctx.reply("Сотрудник удален ✅")
                await ctx.scene.enter("startScreen")
            }
            if (data.action === "statsForToday") {
                const employee = (await getEmployees()).find((employee => employee.id === data.empId))
                const totalAttendanceList = await getAttendance()
                const todayStats = getStatsForToday(employee, totalAttendanceList)

                ctx.replyWithHTML(`<b>Сотрудник:</b> ${employee.username}\n\nПришел: ${todayStats.comingTime}\n\nУшел: ${todayStats.leaveTime}`)
            }
            if (data.action === "statsForWeek") {
                const employee = (await getEmployees()).find((employee => employee.id === data.empId))
                const totalAttendanceList = await getAttendance()
                const statsForWeek = getStatsForWeek(employee, totalAttendanceList)
                await ctx.replyWithHTML(statsForWeek)
            }
            if (data.action === "statsForMonth") {
                const employee = (await getEmployees()).find((employee => employee.id === data.empId))
                const totalAttendanceList = await getAttendance()
                const statsForMonth = getStatsForMonth(employee, totalAttendanceList)
                await ctx.replyWithHTML(statsForMonth)
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