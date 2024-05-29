import {config} from "dotenv";
import {Markup, Scenes, session, Telegraf} from "telegraf";
import {isUserAdmin, isUserRegistered} from "./store/functions.js";
import {
    AdminScenesGenerator,
    generateMonthlyAttendanceExcel,
    generateWeeklyAttendanceExcel,
    UserScenesGenerator
} from "./scenes.js";

const userGen = new UserScenesGenerator()
const adminGen = new AdminScenesGenerator()

const userButtons = userGen.UserButtons()
const markArrival = userGen.MarkArrival()
const markLeaving = userGen.MarkLeaving()

const startScreen = adminGen.StartScreen()
const setOfficeLocation = adminGen.SetOfficeLocation()
const addEmployee = adminGen.AddEmployee()
const showEmployees = adminGen.ShowEmployees()
const showAdmins = adminGen.ShowAdmins()
const addAdmin = adminGen.AddAdmin()
const statsForToday = adminGen.StatsForToday()

const userScenes = [userButtons, markArrival, markLeaving]
const adminScenes = [startScreen, showAdmins, addAdmin, addEmployee, setOfficeLocation, showEmployees, statsForToday]

const stages = new Scenes.Stage([...adminScenes, ...userScenes])

config()

export const bot = new Telegraf(process.env.BOT_TOKEN)
bot.use(session(), stages.middleware(), )

bot.telegram.setMyCommands([
    {command: "start", description: "Начать работу с ботом"},
    {command: "info", description: "Информация о боте"},
])

bot.command("info", async (ctx) => {
    await ctx.reply("Добро пожаловать, данный бот предназначен для проверки посещаемости")
})

bot.start(async (ctx) => {
    ctx.session.isAdmin = await isUserAdmin(ctx.message.from.username)
    const isEmployee = await isUserRegistered(ctx.message.from.username)
    if (ctx.session.isAdmin && isEmployee) {
        await ctx.replyWithSticker("https://chpic.su/_data/stickers/t/tonevskayaaa/tonevskayaaa_035.webp")
        await ctx.replyWithHTML(`Добро пожаловать <b>${ctx.message.from.username}</b>\nВам предоставлены права администратора.`)
        await ctx.scene.enter("startScreen")
    }
    else if (isEmployee) {
        await ctx.replyWithHTML(`Добро пожаловать`)
        await ctx.scene.enter("userButtons")
    } else {
        await ctx.replyWithHTML(`Вы не являетесь сотрудником компании`)
    }
})


bot.hears("Статистика посещения за сегодня", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.scene.enter("statsForToday")
    }
})

bot.hears("Статистика посещения за неделю", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.reply("Статистика посещения сотрудников за текущую неделю");

        try {
            const filePath = await generateWeeklyAttendanceExcel();
            await ctx.replyWithDocument({ source: filePath, filename: `attendance_week_${new Date().toISOString().slice(0, 10)}.xlsx` });
        } catch (err) {
            console.error('Error generating Excel file:', err);
            await ctx.reply('Ошибка при генерации отчета. Пожалуйста, попробуйте позже.');
        }
    }
})

bot.hears("Статистика посещения за месяц", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.reply("Статистика посещения сотрудников за текущий месяц");

        try {
            const filePath = await generateMonthlyAttendanceExcel();
            await ctx.replyWithDocument({ source: filePath, filename: `attendance_month_${new Date().toISOString().slice(0, 10)}.xlsx` });
        } catch (err) {
            console.error('Error generating Excel file:', err);
            await ctx.reply('Ошибка при генерации отчета. Пожалуйста, попробуйте позже.');
        }
    }
})

bot.hears("Список администраторов", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.scene.enter("showAdmins")
    }
})

bot.hears("Список сотрудников", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.scene.enter("showEmployees")
    }
})

bot.hears("Добавить сотрудника", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.scene.enter("addEmployee")
    }
})

bot.hears("Определить зону офиса", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.scene.enter("setOfficeLocation")
    }
})

bot.hears("Я пришел ✌️", async (ctx) => {
    await ctx.scene.enter("markArrival")
})

bot.hears("Я ухожу 👋", async (ctx) => {
    await ctx.scene.enter("markLeaving")
})

bot.launch().then(res => {
    console.log('BOT STARTED')
})