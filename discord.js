const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const TOKEN = process.env.DISCORD_TOKEN;

const LINK_CHANNEL_ID = '1429851667729219594';
const FACTION_CHANNEL_ID = '1429846446185910322';

let players = {};
if (fs.existsSync('./linkedPlayers.json')) {
  players = JSON.parse(fs.readFileSync('./linkedPlayers.json', 'utf8'));
}

function saveData() {
  fs.writeFileSync('./linkedPlayers.json', JSON.stringify(players, null, 2));
}

// --- Link Channel Listener ---
// --- Link Channel Listener ---
client.on('messageCreate', async (msg) => {
  if (msg.channel.id !== LINK_CHANNEL_ID || msg.author.bot) return;
  const ign = msg.content.trim();
  if (!ign) return msg.reply('❌ Please type your in-game name.');

  players[msg.author.id] = { ign, faction: players[msg.author.id]?.faction ?? null };
  saveData();

  await msg.reply(`✅ Linked your Discord to IGN **${ign}**!`);
  setTimeout(() => msg.delete().catch(() => {}), 2000); // deletes their message after 2s
});


// --- Faction Selection Embed ---
client.once('ready', async () => {
  console.log(`${client.user.tag} is online.`);

  const factionEmbed = new EmbedBuilder()
    .setTitle('Choose Your Faction')
    .setDescription('Select your kingdom below:')
    .setColor('Gold');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('aval').setLabel('🦁 Kingdom of Avalis').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('veyra').setLabel('🐉 Kingdom of Veyra').setStyle(ButtonStyle.Danger)
  );

  const channel = await client.channels.fetch(FACTION_CHANNEL_ID);
  if (channel) {
    await channel.send({ embeds: [factionEmbed], components: [row] });
  }
});

// --- Button Handler ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;

  if (!players[userId]) return interaction.reply({ content: '⚠️ You must link your IGN first in the link channel.', ephemeral: true });

  if (interaction.customId === 'aval') players[userId].faction = 'Kingdom of Avalis';
  else if (interaction.customId === 'veyra') players[userId].faction = 'Kingdom of Veyra';
  else return;

  saveData();
  await interaction.reply({ content: `✅ You joined **${players[userId].faction}**!`, ephemeral: true });
});

client.login(TOKEN);
