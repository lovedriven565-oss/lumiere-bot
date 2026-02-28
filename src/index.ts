import { Bot } from "grammy";
import { prisma } from "./database/prisma.js";
import * as dotenv from "dotenv";
import { startHandler } from "./handlers/start.js";
import { callbackHandler } from "./handlers/callbacks.js";
import { photoHandler } from "./handlers/photo.js";
import { profileHandler, createPhotoHandler, packagesHandler, helpHandler, galleryHandler } from "./handlers/menu.js";

dotenv.config();

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  console.error("BOT_TOKEN is not defined in .env file");
  process.exit(1);
}

const bot = new Bot(botToken);

// Commands
bot.command("start", startHandler);
bot.command("profile", profileHandler);
bot.command("help", helpHandler);

// Reply Keyboard Hears
bot.hears("📸 Создать фото", createPhotoHandler);
bot.hears("👤 Мой профиль", profileHandler);
bot.hears("🖼 Галерея стилей", galleryHandler);
bot.hears("💳 Пакеты и цены", packagesHandler);
bot.hears("ℹ️ Помощь", helpHandler);

// Callbacks & Photos
bot.on("callback_query:data", callbackHandler);
bot.on("message:photo", photoHandler);

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully.");

    await bot.api.setMyCommands([
      { command: "start", description: "Главное меню" },
      { command: "profile", description: "Мой профиль" },
      { command: "help", description: "Поддержка" }
    ]);

    console.log("Starting the bot...");
    await bot.start();
  } catch (error) {
    console.error("Error starting the application:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
