import { Context, InlineKeyboard } from "grammy";
import {
  getPaymentKeyboard,
  getGiftPaymentKeyboard,
  getBackToMainKeyboard,
  getMainMenuKeyboard
} from "./keyboards.js";
import { startMessage } from "./start.js";
import { prisma } from "../database/prisma.js";

const STYLE_NAMES: Record<string, string> = {
  style_oldmoney: "💎 Тихая роскошь",
  style_vogue: "📸 Обложка глянца",
  style_castle: "🏰 Княгиня (Мирский)"
};

export const callbackHandler = async (ctx: Context) => {
  if (!ctx.callbackQuery) return;
  const data = ctx.callbackQuery.data;

  console.log('Нажата кнопка:', data);

  try {
    if (data && STYLE_NAMES[data]) {
      const message = `Отличный выбор! 📸 Стоимость нейро-фотосессии: 39 BYN.\n\nОплатите через ЕРИП (Сервис E-POS, код: 12345-1-1). После перевода нажмите кнопку ниже.\n\n⚠️ Нажимая "Я оплатил", вы даете согласие на обработку фото (согласно Закону № 99-З) и принимаете условия Оферты.`;
      await ctx.editMessageText(message, {
        reply_markup: getPaymentKeyboard(data)
      });
    } else if (data === "buy_gift") {
      const message = `🎁 Подарочный сертификат на любую фотосессию!\nСтоимость: 39 BYN. Действует 14 дней.\n\nОплатите через ЕРИП (код E-POS: 12345-1-1).`;
      await ctx.editMessageText(message, {
        reply_markup: getGiftPaymentKeyboard()
      });
    } else if (data === "help_info") {
      const message = `1. Вы выбираете стиль и оплачиваете.\n2. Присылаете 1-3 четких селфи.\n3. Наш ИИ генерирует фото студийного качества за 30 секунд.\nВаши фото удаляются сразу после генерации (Zero-storage).`;
      await ctx.editMessageText(message, {
        reply_markup: getBackToMainKeyboard()
      });
    } else if (data === "back_to_main") {
      await ctx.editMessageText(startMessage, {
        reply_markup: getMainMenuKeyboard()
      });
    } else if (data === "create_photo") {
      // From Profile: open styles menu
      await ctx.editMessageText(startMessage, {
        reply_markup: getMainMenuKeyboard()
      });
    } else if (data?.startsWith("generate_more_")) {
      const styleCode = data.replace("generate_more_", "");
      
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(ctx.from?.id || 0) }
      });

      if (user) {
        const order = await prisma.order.findFirst({
          where: {
            userId: user.id,
            status: { in: ["PAID", "PROCESSING"] },
            photosLeft: { gt: 0 }
          },
          orderBy: { createdAt: 'asc' }
        });

        if (order) {
          // If the user wants to generate more but in a specific style, 
          // we update the order style to match the button they clicked.
          // This allows them to switch styles within their package.
          await prisma.order.update({
            where: { id: order.id },
            data: { style: styleCode, status: "PAID" }
          });
          
          await ctx.reply(`Отлично! Жду ваше селфи для стиля: ${STYLE_NAMES[styleCode] || styleCode}`);
        } else {
          await ctx.reply("К сожалению, у вас нет доступных генераций. Приобретите новый пакет.");
        }
      }
      await ctx.answerCallbackQuery();
    } else if (data === "paid_package") {
      // Re-use existing payment logic for package
      await ctx.answerCallbackQuery({ text: "Отправляем данные на проверку..." }).catch(e => console.error("Ошибка answerCallbackQuery:", e));
      const telegramId = ctx.from?.id;

      if (!telegramId) {
        await ctx.reply("Произошла ошибка (не найден ID). Напишите в поддержку.");
        return;
      }

      try {
        const user = await prisma.user.upsert({
          where: { telegramId: BigInt(telegramId) },
          update: { username: ctx.from?.username },
          create: {
            telegramId: BigInt(telegramId),
            username: ctx.from?.username,
          }
        });

        const order = await prisma.order.create({
          data: {
            userId: user.id,
            style: "package_3", // special style indicating a package, user can choose style later
            status: "PENDING",
            photosLeft: 3
          }
        });

        const adminIdStr = process.env.ADMIN_ID;
        if (adminIdStr) {
          const adminId = Number(adminIdStr);
          const adminMessage = `💰 <b>Новая заявка на пакет генераций!</b>\n\n` +
            `<b>Заказ ID:</b> #${order.id}\n` +
            `<b>Пользователь:</b> @${ctx.from?.username || 'Без_юзернейма'} (ID: ${telegramId})\n` +
            `<b>Пакет:</b> 3 фото\n` +
            `<b>Статус:</b> В ожидании (PENDING)`;

          const adminKeyboard = new InlineKeyboard()
            .text("✅ Подтвердить пакет", `confirm_order_${order.id}`)
            .text("❌ Отклонить", `reject_order_${order.id}`);

          await ctx.api.sendMessage(adminId, adminMessage, {
            parse_mode: "HTML",
            reply_markup: adminKeyboard
          });
        }
        await ctx.reply("⏳ Ваша заявка на пакет отправлена. Мы проверяем поступление средств. Как только оплата подтвердится, вы получите уведомление!");
      } catch (dbError) {
        console.error('Ошибка при покупке пакета:', dbError);
        await ctx.reply("Произошла ошибка. Обратитесь в поддержку.");
      }
      return;
    } else if (data?.startsWith("paid_") && data !== "paid_package") {
      console.log('Начат процесс проверки оплаты для стиля:', data);
      
      // Отвечаем на callback, чтобы кнопка не висела в загрузке
      await ctx.answerCallbackQuery({ text: "Отправляем данные на проверку..." }).catch(e => console.error("Ошибка answerCallbackQuery:", e));

      const styleCode = data.replace("paid_", "");
      const telegramId = ctx.from?.id;

      if (!telegramId) {
        console.error("Ошибка: Не удалось получить telegramId пользователя");
        await ctx.reply("Произошла ошибка (не найден ID). Напишите в поддержку.");
        return;
      }

      try {
        console.log('Поиск или создание пользователя в БД, telegramId:', telegramId);
        const user = await prisma.user.upsert({
          where: { telegramId: BigInt(telegramId) },
          update: { username: ctx.from?.username },
          create: {
            telegramId: BigInt(telegramId),
            username: ctx.from?.username,
          }
        });
        console.log('Пользователь успешно получен/создан. ID в БД:', user.id);

        console.log('Создание заказа в БД...');
        const order = await prisma.order.create({
          data: {
            userId: user.id,
            style: styleCode,
            status: "PENDING"
          }
        });
        console.log('Заказ успешно создан. ID заказа:', order.id);

        // Отправка сообщения админу
        const adminIdStr = process.env.ADMIN_ID;
        if (!adminIdStr) {
          console.error("ВНИМАНИЕ: ADMIN_ID не задан в переменных окружения!");
        } else {
          const adminId = Number(adminIdStr);
          console.log(`Отправка уведомления админу (ID: ${adminId})...`);
          
          const adminMessage = `💰 <b>Новая заявка на оплату!</b>\n\n` +
            `<b>Заказ ID:</b> #${order.id}\n` +
            `<b>Пользователь:</b> @${ctx.from?.username || 'Без_юзернейма'} (ID: ${telegramId})\n` +
            `<b>Стиль/Товар:</b> ${styleCode}\n` +
            `<b>Статус:</b> В ожидании (PENDING)`;

          const adminKeyboard = new InlineKeyboard()
            .text("✅ Подтвердить оплату", `confirm_order_${order.id}`)
            .text("❌ Отклонить", `reject_order_${order.id}`);

          await ctx.api.sendMessage(adminId, adminMessage, {
            parse_mode: "HTML",
            reply_markup: adminKeyboard
          });
          console.log('Уведомление админу успешно отправлено.');
        }

        await ctx.reply("⏳ Ваша заявка отправлена. Мы проверяем поступление средств. Это может занять несколько минут. Как только оплата подтвердится, вы получите уведомление!");
      } catch (dbError) {
        console.error('Ошибка при обработке оплаты (БД или отправка админу):', dbError);
        await ctx.reply("К сожалению, произошла ошибка при оформлении заказа. Пожалуйста, попробуйте еще раз или обратитесь в поддержку.");
      }
      return; // Выходим, чтобы не вызвать answerCallbackQuery второй раз внизу
    } else if (data?.startsWith("confirm_order_") || data?.startsWith("reject_order_")) {
      console.log('Админ нажал кнопку подтверждения/отклонения заказа:', data);
      await ctx.answerCallbackQuery().catch(() => {});

      const isConfirm = data.startsWith("confirm_order_");
      const orderIdStr = isConfirm ? data.replace("confirm_order_", "") : data.replace("reject_order_", "");
      const orderId = Number(orderIdStr);

      if (isNaN(orderId)) {
        console.error("Неверный формат ID заказа:", data);
        await ctx.reply("Ошибка: Неверный формат ID заказа.");
        return;
      }

      try {
        console.log(`Поиск заказа ${orderId} в БД...`);
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { user: true }
        });

        if (!order) {
          console.error("Заказ не найден в БД:", orderId);
          await ctx.reply("Ошибка: Заказ не найден в базе данных.");
          return;
        }

        const newStatus = isConfirm ? "PAID" : "REJECTED";
        
        console.log(`Обновление статуса заказа ${orderId} на ${newStatus}...`);
        await prisma.order.update({
          where: { id: orderId },
          data: { status: newStatus }
        });

        // Отправка сообщения клиенту
        const userTelegramId = Number(order.user.telegramId);
        console.log(`Отправка уведомления пользователю ${userTelegramId}...`);
        
        if (isConfirm) {
          await ctx.api.sendMessage(userTelegramId, 'Оплата успешно подтверждена! 🎉 Теперь отправьте мне 1 ваше лучшее селфи (как фото, не файлом).');
          await ctx.editMessageText(`✅ Заказ #${orderId} подтвержден.`);
        } else {
          await ctx.api.sendMessage(userTelegramId, 'К сожалению, ваша оплата не была подтверждена. Пожалуйста, проверьте статус платежа или обратитесь в поддержку.');
          await ctx.editMessageText(`❌ Заказ #${orderId} отклонен.`);
        }
        
        console.log(`Действие для заказа ${orderId} успешно завершено.`);

      } catch (error) {
        console.error(`Ошибка при обработке заказа ${orderId}:`, error);
        await ctx.reply("Произошла ошибка при обновлении статуса заказа. Проверьте логи.");
      }
    }

    // Универсальный ответ на callback query для остальных кнопок
    if (ctx.callbackQuery.id && !data?.startsWith("paid_")) {
      await ctx.answerCallbackQuery().catch(e => console.error("Ошибка answerCallbackQuery (generic):", e));
    }
  } catch (error) {
    console.error("Глобальная ошибка в callbackHandler:", error);
  }
};
