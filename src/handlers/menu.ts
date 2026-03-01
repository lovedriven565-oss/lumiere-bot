import { Context, InlineKeyboard } from "grammy";
import { InputMediaPhoto } from "grammy/types";
import { prisma } from "../database/prisma.js";
import { getMainMenuKeyboard, getProfileKeyboard } from "./keyboards.js";
import { startMessage } from "./start.js";

export const galleryHandler = async (ctx: Context) => {
  await ctx.reply("🖼 <b>Галерея стилей</b>\nЗагружаю примеры...", { parse_mode: "HTML" });
  
  const mediaGroup: InputMediaPhoto[] = [
    { type: "photo", media: "https://placehold.co/600x800/2c3e50/ffffff.png?text=Old+Money", caption: "1. Тихая роскошь (Old Money)" },
    { type: "photo", media: "https://placehold.co/600x800/e74c3c/ffffff.png?text=Vogue+Cover", caption: "2. Обложка глянца (Vogue)" },
    { type: "photo", media: "https://placehold.co/600x800/8e44ad/ffffff.png?text=Royal+Castle", caption: "3. Княгиня (Castle)" },
    { type: "photo", media: "https://placehold.co/600x800/f39c12/000000.png?text=Cyberpunk", caption: "4. Киберпанк" },
    { type: "photo", media: "https://placehold.co/600x800/27ae60/ffffff.png?text=Fantasy+World", caption: "5. Фэнтези" },
    { type: "photo", media: "https://placehold.co/600x800/ff9ff3/000000.png?text=Anime+Style", caption: "6. Аниме" },
    { type: "photo", media: "https://placehold.co/600x800/bdc3c7/000000.png?text=Studio+Portrait", caption: "7. Студийный портрет" }
  ];
  
  await ctx.replyWithMediaGroup(mediaGroup);
  await ctx.reply("Выберите стиль для генерации:", { reply_markup: getMainMenuKeyboard() });
};

export const profileHandler = async (ctx: Context) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: {
      orders: {
        where: { status: { in: ["PAID", "PROCESSING"] } }
      }
    }
  });

  const photosLeft = user ? user.orders.reduce((sum, order) => sum + order.photosLeft, 0) : 0;

  const msg = `👤 <b>Ваш профиль</b>\n\nID: <code>${telegramId}</code>\nДоступно генераций: <b>${photosLeft}</b>`;

  await ctx.reply(msg, {
    parse_mode: "HTML",
    reply_markup: getProfileKeyboard(photosLeft > 0)
  });
};

export const createPhotoHandler = async (ctx: Context) => {
  await ctx.reply(startMessage, { reply_markup: getMainMenuKeyboard() });
};

export const packagesHandler = async (ctx: Context) => {
  const msg = `💳 <b>Пакеты и цены</b>\n\nПакет на 3 генерации в любом стиле стоит всего <b>39 BYN</b>!\nВы сможете менять стиль перед каждой генерацией.\n\nОплатите через ЕРИП (Сервис E-POS, код: 12345-1-1). После перевода нажмите кнопку ниже.`;
  
  const kb = new InlineKeyboard().text("✅ Я оплатил пакет", "paid_package");
  await ctx.reply(msg, { parse_mode: "HTML", reply_markup: kb });
};

export const helpHandler = async (ctx: Context) => {
  const msg = `ℹ️ <b>Как это работает?</b>\n\n1. Вы выбираете стиль и оплачиваете пакет.\n2. Присылаете 1-3 четких селфи (хороший свет, лицо крупным планом, без шапок и очков).\n3. Наш ИИ генерирует фото студийного качества за 30 секунд.\nВаши фото удаляются сразу после генерации (Zero-storage).\n\n📞 Поддержка: @LumiereSupport`;
  await ctx.reply(msg, { parse_mode: "HTML" });
};
