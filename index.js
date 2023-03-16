import {config} from "dotenv";
import {Markup, Scenes, session, Telegraf} from "telegraf";
import {getAdmins, updateAdmin} from "./store/functions.js";
import {AdminScenesGenerator, UserScenesGenerator} from "./scenes.js";

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
    const admins = await getAdmins()
    admins.forEach(admin => {
        if (ctx.message.from.username === admin.username) {
            ctx.session.isAdmin = true
            updateAdmin({...admin, chat_id: ctx.message.chat.id})
        }
    })
    if (ctx.session.isAdmin) {
        await ctx.replyWithSticker("https://chpic.su/_data/stickers/t/tonevskayaaa/tonevskayaaa_035.webp")
        await ctx.replyWithHTML(`Добро пожаловать <b>${ctx.message.from.username}</b>\nВам предоставлены права администратора.`)
        await ctx.scene.enter("startScreen")
    } else {
        await ctx.replyWithHTML(`Добро пожаловать`)
        await ctx.scene.enter("userButtons")
    }
})


bot.hears("Статистика посещения за сегодня", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.scene.enter("statsForToday")
    }
})

bot.hears("Статистика посещения за неделю", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.replyWithHTML("Перейдите на сайт", Markup.inlineKeyboard([
            [Markup.button.url("Перейти на сайт", "https://vacancies-bot.web.app/?type=week")]
        ]))
    }
})

bot.hears("Статистика посещения за месяц", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.replyWithHTML("Перейдите на сайт", Markup.inlineKeyboard([
            [Markup.button.url("Перейти на сайт", "https://vacancies-bot.web.app/?type=month")]
        ]))
    }
})

bot.hears("Список администраторов", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.scene.enter("showAdmins")
    }
})

bot.hears("Добавить админа", async (ctx) => {
    if (ctx.session.isAdmin) {
        await ctx.scene.enter("addAdmin")
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

bot.launch()