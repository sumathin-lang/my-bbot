'use strict';

function loadSessionAsync (bot, event) {
    let address = event.address;
    return new Promise((resolve, reject) => {
        bot.loadSession(address, (err, session) => {
            if (!err) {
                let locale = getLocaleFromEvent(event);
                if (locale) {
                    session._locale = locale;
                    session.localizer.load(locale, (err2) => {
                        resolve(session);
                    });
                } else {
                    resolve(session);
                }
            } else {
                reject(err);
            }
        });
    });
};

function getLocaleFromEvent(event) {
    // casting to keep away typescript errors
    let currEvent = event;
    if (currEvent.entities && currEvent.entities.length) {
        for (let i = 0; i < currEvent.entities.length; i++) {
            if (currEvent.entities[i].type &&
                currEvent.entities[i].type === "clientInfo" &&
                currEvent.entities[i].locale)
            {
                return currEvent.entities[i].locale;
            }
        }
    }
    return null;
}

module.exports.setup = function(app) {
    var builder = require('botbuilder');
    var teams = require('botbuilder-teams');
    var config = require('config');
    var azure = require('botbuilder-azure'); 
    
    var documentDbOptions = {
        host: 'https://sumathibeatlesdb.documents.azure.com:443/', 
        masterKey: 'FF7co3ZKGfloHj7thLGyWcKw9qItgYUX6Oo83KekBYgjCHVqCsP3QRDI8qiIIXr7skEGytqgnuxk8L9rep9rRQ==', 
        database: 'botdocs',   
        collection: 'botdata'
    };
    var docDbClient = new azure.DocumentDbClient(documentDbOptions);

    var cosmosStorage = new azure.AzureBotStorage({ gzipData: false }, docDbClient);

    if (!config.has("bot.appId")) {
        // We are running locally; fix up the location of the config directory and re-intialize config
        process.env.NODE_CONFIG_DIR = "../config";
        delete require.cache[require.resolve('config')];
        config = require('config');
    }
    // Create a connector to handle the conversations
    var connector = new teams.TeamsChatConnector({
        // It is a bad idea to store secrets in config files. We try to read the settings from
        // the config file (/config/default.json) OR then environment variables.
        // See node config module (https://www.npmjs.com/package/config) on how to create config files for your Node.js environment.
        appId: config.get("bot.appId"),
        appPassword: config.get("bot.appPassword")
    });
    
    var inMemoryBotStorage = new builder.MemoryBotStorage();
    
    var bot = new builder.UniversalBot(connector, function (session) {
        console.info("SSSS bot woke up");
        session.send("Hi... We sell albums. Say 'getAlbums' to see our products.");
    }).set('storage', inMemoryBotStorage);
    
    var stripBotAtMentions = new teams.StripBotAtMentions();
    bot.use(stripBotAtMentions);

    // Add dialog to return list of shirts available
    bot.dialog('getAlbums', function (session) {
        console.info("SSSS showSHirts");
        var msg = new builder.Message(session);
        msg.addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: adaptiveCard
        });
        
        // msg.addAttachment(heroCard);
        session.send(msg).endDialog();
    }).triggerAction({ matches: /^(getAlbums)/i });


    bot.dialog('myQuestion', function (session) {
        console.info("SSSS Show question enteres", session.message);
        session.save();
        var msg = new builder.Message(session);
        questionAdpativeCard.body[0].text = `**${session.message.address.user.name}**`;
        questionAdpativeCard.body[1].text = session.message.value.question;
        msg.addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: questionAdpativeCard
        });
        session.send(msg).endDialog();
    }).triggerAction({ matches: /^(myQuestion)/i });


    var onInvokeHandler = function (event, callback) {
        return async function (
            event,
            callback,
        )
        {
            let session = await loadSessionAsync(bot, event);

            let userName = event.address.user.name;
            console.info("SSSS Invoke handler", event, userName);            
            callback(null, "", 200);
        };        
    };

    connector.onInvoke(onInvokeHandler());

    // Setup an endpoint on the router for the bot to listen.
    // NOTE: This endpoint cannot be changed and must be api/messages
    app.post('/api/messages', connector.listen());

    // Export the connector for any downstream integration - e.g. registering a messaging extension
    module.exports.connector = connector;
};

const simpleAdaptiveCard = {
        "type": "AdaptiveCard",
        "body": [
            {
                "type": "TextBlock",
                "text": "Here is a ninja cat:"
            },
            {
                "type": "Image",
                "url": "http://adaptivecards.io/content/cats/1.png",
                "size": "Medium"
            }
        ],
        "version": "1.0"
};


const questionAdpativeCard = {
    "type": "AdaptiveCard",
    "body": [
        {
            "type": "TextBlock",
            "text": "Name of user"
        },        
        {
            "type": "TextBlock",
            "text": "The question you asked"
        }
    ],    
    "actions": [
        {
            "type": "Action.Submit",
            "id": "Upvote",
            "title": "Upvote",
            "data": {
                "msteams":  {
                    "type": "invoke",
                    "title": "upVote",
                    "value": {
                        "type": "upVote"
                    }                    
                }
            }
        },
        {
            "type": "Action.ShowCard",
            "title": "Comment",
            "card": {
              "type": "AdaptiveCard",
              "body": [
                {
                  "type": "Input.Text",
                  "id": "comment",
                  "isMultiline": true,
                  "placeholder": "Enter your comment"
                }
              ],
              "actions": [
                {
                  "type": "Action.Submit",
                  "title": "OK",
                  "data": {
                    "msteams":  {
                        "type": "invoke",
                        "value": {
                            "type": "addComment"
                        }  
                    }
                  }                  
                }
              ]
            }
        } 
    ]
}

const adaptiveCard = {
    "type": "AdaptiveCard",
    "body": [
        {
            "type": "TextBlock",
            "separator": true,
            "size": "Large",
            "weight": "Bolder",
            "text": "Enter basic information for this position:",
            "isSubtle": true,
            "wrap": true
        },
        {
            "type": "TextBlock",
            "separator": true,
            "text": "Title",
            "wrap": true
        },
        {
            "type": "Input.Text",
            "id": "jobTitle",
            "placeholder": "E.g. Senior PM"
        },
        {
            "type": "ColumnSet",
            "columns": [
                {
                    "type": "Column",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": "Level",
                            "wrap": true
                        },
                        {
                            "type": "Input.Number",
                            "id": "jobLevel",
                            "value": "7",
                            "placeholder": "Level",
                            "min": 7,
                            "max": 10
                        }
                    ],
                    "width": 2
                },
                {
                    "type": "Column",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": "Location"
                        },
                        {
                            "type": "Input.ChoiceSet",
                            "id": "jobLocation",
                            "value": "1",
                            "choices": [
                                {
                                    "title": "San Francisco",
                                    "value": "1"
                                },
                                {
                                    "title": "London",
                                    "value": "2"
                                },
                                {
                                    "title": "Singapore",
                                    "value": "3"
                                },
                                {
                                    "title": "Dubai",
                                    "value": "3"
                                },
                                {
                                    "title": "Frankfurt",
                                    "value": "3"
                                }
                            ],
                            "isCompact": true
                        }
                    ],
                    "width": 2
                }
            ]
        }
    ],
    "actions": [
        {
            "type": "Action.Submit",
            "id": "createPosting",
            "title": "Create posting",
            "data": {
                "msteams":  {
                    "type": "messageBack",
                    "text": "myQuestion",
                    "value": "{\"bfKey\": \"bfVal\", \"conflictKey\": \"from value\"}"
                }
            }
        },
        {
            "type": "Action.Submit",
            "id": "cancel",
            "title": "Cancel"
        },
        {
            "type": "Action.ShowCard",
            "title": "Ask question",
            "card": {
              "type": "AdaptiveCard",
              "body": [
                {
                  "type": "Input.Text",
                  "id": "question",
                  "isMultiline": true,
                  "placeholder": "Enter your question"
                }
              ],
              "actions": [
                {
                  "type": "Action.Submit",
                  "title": "OK",
                  "data": {
                    "msteams":  {
                        "type": "messageBack",
                        "text": "myQuestion",
                        "value": "{\"bfKey\": \"bfVal\", \"conflictKey\": \"from value\"}"
                    }
                  }                  
                }
              ]
            }
        }        
    ],
    "version": "1.0"
};

const heroCard = {
    "contentType": "application/vnd.microsoft.card.hero",
    "content": {
      "title": "Seattle Center Monorail",
      "subtitle": "Seattle Center Monorail",
      "text": "The Seattle Center Monorail is an elevated train line between Seattle Center (near the Space Needle) and downtown Seattle. It was built for the 1962 World's Fair. Its original two trains, completed in 1961, are still in service.",
      "images": [
        {
          "url":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Seattle_monorail01_2008-02-25.jpg/1024px-Seattle_monorail01_2008-02-25.jpg"
        }
      ],
     "buttons": [
       {
          "type": "openUrl",
          "title": "Official website",
          "value": "https://www.seattlemonorail.com"
        },
       {
         "type": "invoke",
         "title": "send invoke",
         "value": "{\"property\": \"propertyValue\" }"
        }
      ]
    }
 }
 