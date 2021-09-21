/* *
 * */
const Alexa = require('ask-sdk-core');
const LocalDate = require('./local-date');
LocalDate.setTimezoneOffset(9 * 60);    // 9 hours ahead to UTC
const sprintf = require('sprintf-js').sprintf;
const ReminderDelayInMinutes = 2;
const TokenToEnableReminder = 'TokenToEnableReminder';
const TokenToDisableReminder = 'TokenToDisableReminder';
const TokenToSkipReminder = 'TokenToSkipReminder';

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('ようこそ')
            .reprompt('リマインドして、とか、リマインダーを解除して、とか、散歩したよ、と言ってみてください。')
            .getResponse();
    }
};

const EnableReminderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'EnableReminderIntent';
    },
    async handle(handlerInput) {
        console.log('EnableReminderInputHandler');

        return await enableReminder(
            getReminderClient(handlerInput),
            handlerInput.responseBuilder);
    }
};

const DisableReminderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DisableReminderIntent';
    },
    async handle(handlerInput) {
        console.log('DisableReminderInputHandler');

        return await disableReminder(
            getReminderClient(handlerInput),
            handlerInput.responseBuilder);
    }
};

const RecordTaskIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RecordTaskIntent';
    },
    async handle(handlerInput) {
        console.log('RecordTaskInputHandler');

        return await skipReminder(
            getReminderClient(handlerInput),
            handlerInput.responseBuilder);
    }
};

const ReminderPermissionResponseHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Connections.Response'
            && handlerInput.requestEnvelope.request.name === 'AskFor'
    },
    async handle(handlerInput) {
        console.log('PermissionResponseHandler');

        const { status, token, payload } = handlerInput.requestEnvelope.request;
        let response;

        if (status.code === '200') {
            switch (payload.status) {
                case 'ACCEPTED':
                    const reminderClient = getReminderClient(handlerInput);
                    const responseBuilder = handlerInput.responseBuilder;

                    if (token === TokenToEnableReminder) {
                        response = await enableReminder(reminderClient, responseBuilder);
                    }
                    else if (token === TokenToDisableReminder) {
                        response = await disableReminder(reminderClient, responseBuilder);
                    }
                    else {
                        response = await skipReminder(reminderClient, responseBuilder);
                    }
                    break;
                case 'DENIED':
                case 'NOT_ANSWERED':
                    let operation;

                    if (token === TokenToEnableReminder) {
                        operation = '設定';
                    }
                    else if (token === TokenToDisableReminder) {
                        operation = '解除';
                    }
                    else {
                        operation = 'スキップ';
                    }

                    const msg =
                        `リマインダーにアクセスする許可を頂けなかったので、リマインダーの${operation}はしていません。` +
                        'アクセスを許可する場合は、再度リクエストを繰り返すか、Alexaアプリのホーム画面で、リマインダーへのアクセスを許可してください。';

                    if (!payload.isCardThrown) {
                        response = handlerInput.responseBuilder
                            .speak(msg)
                            .withAskForPermissionsConsentCard(
                                ['alexa::alerts:reminders:skill:readwrite'])
                            .withShouldEndSession(true)
                            .getResponse();
                    }
                    else {
                        response = handlerInput.responseBuilder
                            .speak(msg)
                            .withShouldEndSession(true)
                            .getResponse();
                    }
                    break;
                default:
                    // 発生しないはず
                    console.log(`AskForReminder failed: ${status.code}, ${status.message}`);
                    response = handlerInput.responseBuilder
                        .speak('内部エラーが発生しました。')
                        .withShouldEndSession(true)
                        .getResponse();
            }
        }
        else if (status.code === '204') {
            console.log(`AskForReminder failed: ${status.code}, ${status.message}`);
            response = handlerInput.responseBuilder
                .speak('リクエストの処理を打ち切ります。')
                .withShouldEndSession(true)
                .getResponse();
        }
        else {
            console.log(`AskForReminder failed: ${status.code}, ${status.message}`);
            response = handlerInput.responseBuilder
                .speak('内部エラーが発生しました。')
                .withShouldEndSession(true)
                .getResponse();
        }

        return response;
    }
};

function getReminderClient(handlerInput) {
    return handlerInput.serviceClientFactory.getReminderManagementServiceClient();
}

async function getReminders(reminderClient) {
    console.log('getReminders');

    try {
        return await reminderClient.getReminders();
    }
    catch (error) {
        if (error.name === 'ServiceError') {
            console.log(`Service Error - Code: ${error.statusCode}, Message: ${error.message}`);

            if (error.statusCode === 401) {
                // アクセス権が無い
                return null;
            }
            else if (error.statusCode === 404) {
                // 設定されているリマインダーが無い
                return { alerts: [] };
            }
        }
        else {
            console.log(`None Service Error: ${error.stack}`);
        }

        throw error;
    }
}

function buildGrantRemindersAccessResponse(responseBuilder, token) {
    console.log('buildGrantRemindersAccessResponse');

    return response = responseBuilder
        .addDirective({
            type: 'Connections.SendRequest',
            name: 'AskFor',
            payload: {
                '@type': 'AskForPermissionsConsentRequest',
                '@version': '1',
                'permissionScope': 'alexa::alerts:reminders:skill:readwrite'
            },
            token: token
        })
        .getResponse();
}

async function enableReminder(reminderClient, responseBuilder) {
    console.log('enableReminder');

    const reminders = await getReminders(reminderClient, TokenToEnableReminder);

    if (reminders) {
        // アクセス権が付与されている
        for (const alert of reminders.alerts) {
            // 既存のリマインダーを削除
            await reminderClient.deleteReminder(alert.alertToken);
        }

        // リマインダーを作成
        const startDateTimeString = getStartDateTimeStringToday();

        const now = new Date();
        const recurrenceTime = {};
        recurrenceTime.byHour = LocalDate.getHours(now);
        recurrenceTime.byMinute = LocalDate.getMinutes(now) + ReminderDelayInMinutes;
        recurrenceTime.bySecond = LocalDate.getSeconds(now);

        const reminderRequest = buildReminderRequest(startDateTimeString, recurrenceTime);

        try {
            await reminderClient.createReminder(reminderRequest);

            return responseBuilder
                .speak(`リマインダーを${recurrenceTime.byHour}時${recurrenceTime.byMinute}分${recurrenceTime.bySecond}秒に設定しました。`)
                .withShouldEndSession(true)
                .getResponse();
        }
        catch (error) {
            if (error.name === 'ServiceError') {
                console.log(`Service Error - Code: ${error.statusCode}, Message: ${error.message}`);

                if (error.statusCode === 403) {
                    // リマインダーが設定できない (Alexaシミュレータなど)
                    return responseBuilder
                        .speak('このデバイスでは、リマインダーを設定できません。')
                        .withShouldEndSession(true)
                        .getResponse();
                }
            }
            else {
                console.log(`None Service Error: ${error.stack}`);
            }

            throw error;
        }
    }
    else {
        // アクセス権が付与されていない
        // Alexaにユーザーからアクセス権を取得するように依頼する
        return buildGrantRemindersAccessResponse(
            responseBuilder,
            TokenToEnableReminder);
    }
}

async function disableReminder(reminderClient, responseBuilder) {
    console.log('disableReminder');

    const reminders = await getReminders(reminderClient);
    let response;

    if (reminders) {
        // アクセス権が付与されている
        if (reminders.alerts.length > 0) {
            // 既存のリマインダーがある
            for (const alert of reminders.alerts) {
                // 既存のリマインダーを削除
                await reminderClient.deleteReminder(alert.alertToken);
            }

            response = responseBuilder
                .speak('リマインダーを解除しました。')
                .withShouldEndSession(true)
                .getResponse();
        }
        else {
            // 既存のリマインダーは無い
            response = responseBuilder
                .speak('設定されているリマインダーはありません。')
                .withShouldEndSession(true)
                .getResponse();
        }
    }
    else {
        // アクセス権が付与されていない
        // Alexaにユーザーからアクセス権を取得するように依頼する
        response = buildGrantRemindersAccessResponse(
            responseBuilder,
            TokenToDisableReminder);
    }

    return response;
}

function buildReminderRequest(startDateTimeString, recurrenceTime) {
    const reminderText = '散歩の時間';
    const now = new Date();
    const requestTime = LocalDate.toISOStringNZ(now);

    const ssmlText = `<speak>散歩をしてください。</speak>`;
    const reminderRequest = {
        requestTime: requestTime,
        trigger: {
            type: "SCHEDULED_ABSOLUTE",
            timeZoneId: 'Asia/Tokyo', // Default is the device's timezone
            recurrence: {
                startDateTime: startDateTimeString,
                recurrenceRules: [
                    `FREQ=DAILY;BYHOUR=${recurrenceTime.byHour};BYMINUTE=${recurrenceTime.byMinute};BYSECOND=${recurrenceTime.bySecond};INTERVAL=1;`
                ]
            }
        },
        alertInfo: {
            spokenInfo: {
                content: [{
                    locale: 'ja-JP',
                    text: reminderText,
                    ssml: ssmlText
                }]
            }
        },
        pushNotification: {
            status: 'ENABLED'
        }
    }

    return reminderRequest;
}

const ReminderDateTimeString = '%d-%02d-%02dT%02d:%02d:%02d';

// 今日の午前零時を返す
function getStartDateTimeStringToday() {
    const now = new Date();

    const dateTimeString = sprintf(ReminderDateTimeString,
        LocalDate.getFullYear(now),
        LocalDate.getMonth(now) + 1,
        LocalDate.getDate(now),
        0,                          // Hours
        0,                          // Minutes
        0                           // Seconds
    );

    return dateTimeString;
}

// 明日の午前零時を返す
function getStartDateTimeStringTomorrow() {
    const now = new Date();
    const nextDate = LocalDate.nextDate(now);
    const dateTimeString = sprintf(ReminderDateTimeString,
        LocalDate.getFullYear(nextDate),
        LocalDate.getMonth(nextDate) + 1,
        LocalDate.getDate(nextDate),
        0,                          // Hours
        0,                          // Minutes
        0                           // Seconds
    );

    return dateTimeString;
}

async function skipReminder(reminderClient, responseBuilder) {
    console.log('skipReminder');

    const reminders = await getReminders(reminderClient);
    let response;

    if (reminders) {
        // アクセス権が付与されている
        if (reminders.alerts.length > 0) {
            // 既存のリマインダーがある
            for (const reminder of reminders.alerts) {
                // 既存のリマインダーを更新
                const now = new Date();
                const recurrenceTime = {};
                recurrenceTime.byHour = LocalDate.getHours(now);
                recurrenceTime.byMinute = LocalDate.getMinutes(now) + ReminderDelayInMinutes;
                recurrenceTime.bySecond = LocalDate.getSeconds(now);
                const newReminder = buildReminderRequest(
                    getStartDateTimeStringTomorrow(),
                    recurrenceTime);
                await reminderClient.deleteReminder(reminder.alertToken);
                await reminderClient.createReminder(newReminder);
                // 本来下記のように開始日のみ書き換えて更新すれば良い。
                // 複数デバイスがあるときに、リマインダを作成したデバイス以外に更新が伝わらない
                // という現象があり、削除と作成を組み合わせている。
                // reminder.trigger.recurrence.startDateTime = getStartDateTimeStringTomorrow();
                // await reminderClient.updateReminder(reminder.alertToken, reminder);
            }

            response = responseBuilder
                .speak('お疲れさまです。明日またリマインドしますね。')
                .withShouldEndSession(true)
                .getResponse();
        }
        else {
            // 既存のリマインダーは無い
            response = responseBuilder
                .speak('お疲れさまです。リマインダーは設定されていません。')
                .withShouldEndSession(true)
                .getResponse();
        }
    }
    else {
        // アクセス権が付与されていない
        // Alexaにユーザーからアクセス権を取得するように依頼する
        response = buildGrantRemindersAccessResponse(
            responseBuilder,
            TokenToSkipReminder);
    }

    return response;
}

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('Goodbye')
            .withShouldEndSession(true)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'すみません、良くわかりませんでした。言い直してみてください。!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = ` ${intentName}は、まだサポートされていないコマンドです。`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .withShouldEndSession(true)
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'すみません、内部でエラーが発生しました。';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            // .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
const handlers = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        EnableReminderIntentHandler,
        DisableReminderIntentHandler,
        ReminderPermissionResponseHandler,
        RecordTaskIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withApiClient(new Alexa.DefaultApiClient())
    .withCustomUserAgent('sample/hello-world/v1.2');

exports.skill = handlers.create();
exports.handler = handlers.lambda();