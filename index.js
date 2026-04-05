const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');

// ============================================
// EXPRESS SERVER - KEEP ALIVE
// ============================================
const app = express();
app.get('/', (req, res) => {
    res.send('🧔 Dziadek Tech Bot System Online!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Express uruchomiony na porcie ${PORT}`);
});

// ============================================
// DATABASE
// ============================================
let database = {};
const DB_FILE = './dziadek-tech-db.json';

function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            database = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } else {
            database = { 
                servers: {}, 
                users: {}, 
                bots: {},
                funds: {},
                tickets: {}
            };
            saveDB();
        }
    } catch (e) {
        console.error('❌ Błąd ładowania DB:', e);
        database = { servers: {}, users: {}, bots: {}, funds: {}, tickets: {} };
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
    } catch (e) {
        console.error('❌ Błąd zapisywania DB:', e);
    }
}

loadDB();

// ============================================
// CONFIG
// ============================================
const CONFIG = {
    TOKEN: 'MTQwNzA2ODU1MTczNDM2NjMzOQ.GA8wlw.odoCL3KsNOHUoalZ6eiYjBgJVVR_oMRBcBQ3eM',
    PREFIX: '!',
    CROWN_EMOJI_ID: '1439004112178905197', // ID emoji korony (ustaw sam)
    
    // Ceny
    PRICING: {
        bot1: 0,      // Free
        bot2: 5,      // 5 PLN
        bot3: 5,      // 5 PLN
    },
    
    // Moduły (0.50 zł taniej)
    MODULES: {
        'System Dowodów + Rejestrowanie Aut': 2.00, // był 2.50
        'Custom Status Bota - Wiadomość': 3.00,     // był 3.50
        'RP Komendy (/me, /do, /try)': 0.00,        // byl 0.50
        'System Weryfikacji': 1.50,                 // był 2.00
        'Roleplay Panel': 3.50,                     // był 4.00
        'System Sprawdzania Aktywności': 2.50,      // był 3.00
        'Status Bota jako wiadomość - ERLC ILOSC OSOB NA SERWERZE': 4.50, // był 5.00
        'System Anonimowy Darkweb': 1.00,           // był 1.50
        'System Skarg & Pochwal dla administracji': 2.00, // był 2.50
    }
};

// ============================================
// CLIENT
// ============================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
    ]
});

client.once('ready', () => {
    console.log(`✅ Bot zalogowany jako ${client.user.tag}`);
    console.log(`✅ Dziadek Tech Bot Builder uruchomiony!`);
    client.user.setActivity('!help | Dziadek Tech', { type: 'WATCHING' });
});

// ============================================
// COMMANDS
// ============================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(CONFIG.PREFIX)) return;

    const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
    const command = args[0]?.toLowerCase();

    if (!command) return;

    try {
        // HELP
        if (command === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setColor('#2C2F33')
                .setTitle('🧔 Dziadek Tech - Bot Builder')
                .setDescription('System zarządzania botami dla Discord')
                .addFields(
                    { name: '🤖 Boty', value: '`!newbot` - Utwórz nowego bota\n`!mybot` - Twoje boty\n`!botpanel` - Panel bota', inline: false },
                    { name: '💰 Fundusze', value: '`!funds` - Twoje fundusze\n`!buy [moduł]` - Kup moduł', inline: false },
                    { name: '⚙️ Admin', value: '`!dodajkase @user kwota` - Dodaj fundusze', inline: false }
                )
                .setFooter({ text: 'Dziadek Tech © 2026' })
                .setTimestamp();

            await message.reply({ embeds: [helpEmbed] });
            return;
        }

        // NEWBOT - Utwórz nowego bota
        if (command === 'newbot') {
            const serverId = message.guildId;
            const userId = message.author.id;

            if (!database.servers[serverId]) {
                database.servers[serverId] = { bots: [], owner: message.member.displayName };
                saveDB();
            }

            const userBots = database.servers[serverId].bots.filter(b => b.owner === userId) || [];
            
            // Sprawdzenie limitów
            if (userBots.length >= 3) {
                await message.reply('❌ Maksymalnie 3 boty na serwer!');
                return;
            }

            // Sprawdzenie ceny
            const botNumber = userBots.length + 1;
            const price = botNumber === 1 ? 0 : 5;

            if (price > 0) {
                const userFunds = database.funds[userId] || 0;
                if (userFunds < price) {
                    await message.reply(`❌ Brak funduszy! Potrzebujesz ${price} PLN. Masz: ${userFunds} PLN`);
                    return;
                }
                database.funds[userId] = userFunds - price;
            }

            // Tworzenie bota
            const botId = `bot-${Date.now()}`;
            const newBot = {
                id: botId,
                name: `${message.author.username}'s Bot #${botNumber}`,
                owner: userId,
                number: botNumber,
                enabled: true,
                prefix: '!',
                createdAt: new Date().toISOString(),
                config: {
                    serverName: message.guild.name,
                    panelChannelId: null,
                    logsChannelId: null,
                    ticketChannelId: null,
                    welcomeChannelId: null,
                },
                modules: [],
                funds: price === 0 ? 5 : 0,
            };

            if (!database.servers[serverId].bots) {
                database.servers[serverId].bots = [];
            }
            database.servers[serverId].bots.push(botId);
            database.bots[botId] = newBot;
            saveDB();

            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Bot Stworzony!')
                .addFields(
                    { name: 'Nazwa', value: newBot.name, inline: true },
                    { name: 'Koszt', value: `${price} PLN`, inline: true },
                    { name: 'Gratis Fundusze', value: `${newBot.funds} PLN`, inline: true }
                )
                .setFooter({ text: `Użyj !botpanel ${botId}` });

            await message.reply({ embeds: [successEmbed] });
            return;
        }

        // MYBOT - Twoje boty
        if (command === 'mybot') {
            const serverId = message.guildId;
            const userId = message.author.id;

            if (!database.servers[serverId]) {
                await message.reply('❌ Brak botów na tym serwerze!');
                return;
            }

            const userBots = database.servers[serverId].bots
                .filter(botId => database.bots[botId]?.owner === userId)
                .map(botId => database.bots[botId]);

            if (userBots.length === 0) {
                await message.reply('❌ Brak twoich botów!');
                return;
            }

            const botList = userBots
                .map((bot, i) => `${i + 1}. **${bot.name}**\n   Status: ${bot.enabled ? '✅ ON' : '❌ OFF'}\n   Fundusze: ${bot.funds} PLN`)
                .join('\n\n');

            const listEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🤖 Twoje Boty')
                .setDescription(botList)
                .setFooter({ text: `Użyj !botpanel [ID] aby zarządzać` });

            await message.reply({ embeds: [listEmbed] });
            return;
        }

        // BOTPANEL - Panel bota
        if (command === 'botpanel') {
            const botId = args[1];
            if (!botId) {
                await message.reply('❌ Użycie: `!botpanel [ID bota]`');
                return;
            }

            const bot = database.bots[botId];
            if (!bot) {
                await message.reply('❌ Bot nie istnieje!');
                return;
            }

            if (bot.owner !== message.author.id) {
                await message.reply('❌ Nie jesteś właścicielem tego bota!');
                return;
            }

            // Panel embed
            const panelEmbed = new EmbedBuilder()
                .setColor('#2C2F33')
                .setTitle(`🤖 ${bot.name}`)
                .addFields(
                    { name: 'Trial do', value: new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('pl-PL'), inline: true },
                    { name: 'Następne rozliczenie', value: new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('pl-PL'), inline: true },
                    { name: 'Cena cykliczna', value: `3.00 PLN / 30 dni`, inline: true },
                    { name: 'Jak używać panelu?', value: `• **Włącz** - uruchamia bota\n• **Wyłącz** - zatrzymuje bota\n• **Zresetuj** - restartuje\n• **Panel kupowania** - kupuj moduły\n• **Zarządzaj modułami** - włącz/wyłącz\n• **Konfiguracja systemów** - ustaw kanały\n• **Poradnik** - instrukcja`, inline: false }
                )
                .setFooter({ text: 'Dziadek Tech Client Bot Panel' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`bot_toggle_${botId}`)
                        .setLabel(bot.enabled ? 'Wyłącz' : 'Włącz')
                        .setStyle(bot.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`bot_restart_${botId}`)
                        .setLabel('Zresetuj')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`bot_shop_${botId}`)
                        .setLabel('Panel kupowania')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`bot_modules_${botId}`)
                        .setLabel('Zarządzaj modułami')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`bot_config_${botId}`)
                        .setLabel('Konfiguracja systemów')
                        .setStyle(ButtonStyle.Secondary)
                );

            await message.reply({ embeds: [panelEmbed], components: [row] });
            return;
        }

        // FUNDS - Twoje fundusze
        if (command === 'funds') {
            const funds = database.funds[message.author.id] || 0;
            const fundsEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('💰 Twoje Fundusze')
                .setDescription(`Dostępne: **${funds} PLN**`)
                .setFooter({ text: 'Kup moduły komendą !buy' });

            await message.reply({ embeds: [fundsEmbed] });
            return;
        }

        // DODAJKASE - Dodaj kasę (tylko korona)
        if (command === 'dodajkase') {
            // Sprawdzenie czy ma koronkę
            const crownRole = message.guild.roles.cache.find(r => r.name.includes('korona') || r.name.includes('crown'));
            if (!crownRole || !message.member.roles.cache.has(crownRole.id)) {
                await message.reply('❌ Brak uprawnień! Potrzebujesz roli z koroną.');
                return;
            }

            const target = message.mentions.users.first();
            const amount = parseFloat(args[2]);

            if (!target || !amount || amount <= 0) {
                await message.reply('❌ Użycie: `!dodajkase @user kwota`');
                return;
            }

            database.funds[target.id] = (database.funds[target.id] || 0) + amount;
            saveDB();

            const addEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Fundusze Dodane')
                .addFields(
                    { name: 'Użytkownik', value: target.tag, inline: true },
                    { name: 'Kwota', value: `+${amount} PLN`, inline: true },
                    { name: 'Razem', value: `${database.funds[target.id]} PLN`, inline: true }
                );

            await message.reply({ embeds: [addEmbed] });

            try {
                await target.send({ embeds: [addEmbed] });
            } catch (e) {}
            return;
        }

    } catch (error) {
        console.error('❌ Błąd w messageCreate:', error);
        message.reply('❌ Błąd!').catch(() => {});
    }
});

// ============================================
// INTERACTIONS
// ============================================
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isButton()) {
            // BOT TOGGLE
            if (interaction.customId.startsWith('bot_toggle_')) {
                const botId = interaction.customId.replace('bot_toggle_', '');
                const bot = database.bots[botId];

                if (bot.owner !== interaction.user.id) {
                    return await interaction.reply({ content: '❌ Nie jesteś właścicielem!', ephemeral: true });
                }

                bot.enabled = !bot.enabled;
                saveDB();

                const toggleEmbed = new EmbedBuilder()
                    .setColor(bot.enabled ? '#00FF00' : '#FF0000')
                    .setTitle(bot.enabled ? '✅ Bot Włączony' : '❌ Bot Wyłączony')
                    .setDescription(`Bot **${bot.name}** został ${bot.enabled ? 'włączony' : 'wyłączony'}`);

                await interaction.reply({ embeds: [toggleEmbed], ephemeral: true });
                return;
            }

            // BOT SHOP
            if (interaction.customId.startsWith('bot_shop_')) {
                const botId = interaction.customId.replace('bot_shop_', '');
                const bot = database.bots[botId];

                if (bot.owner !== interaction.user.id) {
                    return await interaction.reply({ content: '❌ Nie jesteś właścicielem!', ephemeral: true });
                }

                const modulesOptions = Object.entries(CONFIG.MODULES).map(([name, price]) => ({
                    label: `${name} - ${price} PLN`,
                    value: name,
                    description: `Cena: ${price} PLN`
                }));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`buy_module_${botId}`)
                    .setPlaceholder('Wybierz moduł...')
                    .addOptions(modulesOptions);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                const shopEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🛒 Sklep Modułów')
                    .setDescription(`Twoje fundusze: **${bot.funds} PLN**`)
                    .setFooter({ text: 'Wybierz moduł aby kupić' });

                await interaction.reply({ embeds: [shopEmbed], components: [row], ephemeral: true });
                return;
            }

            // BOT MODULES
            if (interaction.customId.startsWith('bot_modules_')) {
                const botId = interaction.customId.replace('bot_modules_', '');
                const bot = database.bots[botId];

                if (bot.owner !== interaction.user.id) {
                    return await interaction.reply({ content: '❌ Nie jesteś właścicielem!', ephemeral: true });
                }

                if (bot.modules.length === 0) {
                    return await interaction.reply({ content: '❌ Brak zakupionych modułów!', ephemeral: true });
                }

                const moduleList = bot.modules.map(m => `✅ ${m}`).join('\n');

                const modulesEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📦 Twoje Moduły')
                    .setDescription(moduleList);

                await interaction.reply({ embeds: [modulesEmbed], ephemeral: true });
                return;
            }

            // BOT CONFIG
            if (interaction.customId.startsWith('bot_config_')) {
                const botId = interaction.customId.replace('bot_config_', '');
                const bot = database.bots[botId];

                if (bot.owner !== interaction.user.id) {
                    return await interaction.reply({ content: '❌ Nie jesteś właścicielem!', ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`config_modal_${botId}`)
                    .setTitle('⚙️ Konfiguracja Systemów');

                const serverNameInput = new TextInputBuilder()
                    .setCustomId('server_name')
                    .setLabel('Nazwa serwera / marki')
                    .setValue(bot.config.serverName || '')
                    .setStyle(TextInputStyle.Short);

                const panelChannelInput = new TextInputBuilder()
                    .setCustomId('panel_channel')
                    .setLabel('Kanał panelu obserwatela (ID)')
                    .setValue(bot.config.panelChannelId || '')
                    .setStyle(TextInputStyle.Short);

                const logsChannelInput = new TextInputBuilder()
                    .setCustomId('logs_channel')
                    .setLabel('Kanał dowodów (ID)')
                    .setValue(bot.config.logsChannelId || '')
                    .setStyle(TextInputStyle.Short);

                const ticketChannelInput = new TextInputBuilder()
                    .setCustomId('ticket_channel')
                    .setLabel('Kanał pojazów (ID)')
                    .setValue(bot.config.ticketChannelId || '')
                    .setStyle(TextInputStyle.Short);

                const welcomeChannelInput = new TextInputBuilder()
                    .setCustomId('welcome_channel')
                    .setLabel('Kanał panelu wyszkukiwarki (ID)')
                    .setValue(bot.config.welcomeChannelId || '')
                    .setStyle(TextInputStyle.Short);

                const row1 = new ActionRowBuilder().addComponents(serverNameInput);
                const row2 = new ActionRowBuilder().addComponents(panelChannelInput);
                const row3 = new ActionRowBuilder().addComponents(logsChannelInput);
                const row4 = new ActionRowBuilder().addComponents(ticketChannelInput);
                const row5 = new ActionRowBuilder().addComponents(welcomeChannelInput);

                modal.addComponents(row1, row2, row3, row4, row5);
                await interaction.showModal(modal);
                return;
            }
        }

        // SELECT MENU - BUY MODULE
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('buy_module_')) {
                const botId = interaction.customId.replace('buy_module_', '');
                const bot = database.bots[botId];
                const moduleName = interaction.values[0];
                const price = CONFIG.MODULES[moduleName];

                if (bot.owner !== interaction.user.id) {
                    return await interaction.reply({ content: '❌ Nie jesteś
