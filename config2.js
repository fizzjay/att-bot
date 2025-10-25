module.exports = {
    // NOTE: To get a client secret/ID please email support@altavr.io. In that email include your in-game name and what you would like your bot to be called. = {
      attConfig: {
clientId: process.env.ATT_CLIENT,
clientSecret: process.env.ATT_SECRET,

          scope: [ 'ws.group', 'ws.group_members', 'ws.group_servers', 'ws.group_bans', 'group.info', 'group.join', 'group.leave', 'group.view', 'group.members', 'server.view', 'server.console'],
          logVerbosity: 0,
    },

    userConfig: {
      playerUsername: 'Wetdog.'
    }
  }