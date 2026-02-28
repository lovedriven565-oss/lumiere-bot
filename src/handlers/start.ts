import { Context } from "grammy";
import { getMainMenuKeyboard, getReplyMainMenu } from "./keyboards.js";

export const startMessage = "✨ Lumiere BY — Ваша персональная нейро-фотосессия\n\nМы создаем студийные портреты с помощью ИИ. Выберите стиль, загрузите селфи — и через минуту забирайте результат!";

export const startHandler = async (ctx: Context) => {
  // Отправляем Reply-клавиатуру с коротким приветствием
  await ctx.reply("Добро пожаловать в Lumiere BY! Воспользуйтесь меню ниже для навигации.", {
    reply_markup: getReplyMainMenu()
  });

  // Отправляем основное сообщение с Inline-клавиатурой
  await ctx.reply(startMessage, {
    reply_markup: getMainMenuKeyboard()
  });
};

