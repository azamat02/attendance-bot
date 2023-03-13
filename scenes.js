import {Markup, Scenes} from "telegraf";
import {
    createAdmin,
    createEmployee,
    createOfficeLocation,
    deleteAdmin,
    getAdmins, getAttendance,
    getEmployees,
    getOfficeLocation,
    markAttendance, markLeavingAttendance
} from "./store/functions.js";

function isMarkedToday(attendance, from) {
    let res = {
        isMarkedToday: false,
        attendance: []
    }
    attendance.forEach(attendance => {
        if (from.username === attendance.user.username && +from.id === +attendance.user.id) {
            let comingTime = new Date(+attendance.comingTime.seconds * 1000)
            if (comingTime.getDate() === new Date().getDate()) {
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
                }
            } else {
                await ctx.reply("Вы не являетесь сотрудником Сапа")
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
            } else {
                await ctx.reply("Вы далеко от офиса, повторите попытку когда будете в офисе 📍")
                await ctx.scene.enter("check")
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
                    ctx.scene.leave()
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
        })

        markLeaving.leave()

        return markLeaving
    }
}

export class AdminScenesGenerator{
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


        startScreen.hears("Список администраторов", async (ctx) => {
            await ctx.scene.enter("showAdmins")
        })

        startScreen.hears("Добавить админа", async (ctx) => {
            await ctx.scene.enter("addAdmin")
        })

        startScreen.hears("Добавить сотрудника", async (ctx) => {
            await ctx.scene.enter("addEmployee")
        })

        startScreen.hears("Определить зону офиса", async (ctx) => {
            await ctx.scene.enter("setOfficeLocation")
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
            await ctx.replyWithPhoto({source: "./assets/example2.png"}, Markup.removeKeyboard())
            await ctx.reply("Введите <b>username</b> пользователя (без @): ", {parse_mode: "HTML"})
        })
        showEmployees.on("text", async (ctx) => {
            let employee = {
                username: ctx.message.text
            }
            await createEmployee(employee)
            await ctx.reply("Сотрудник добавлен ✅")
            await ctx.scene.enter("startScreen")
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