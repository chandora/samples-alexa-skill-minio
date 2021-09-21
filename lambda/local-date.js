const sprintf = require('sprintf-js').sprintf;

class LocalDate {
    static setTimezoneOffset(timezoneOffsetInMinutes) {
        LocalDate.timezoneOffset = timezoneOffsetInMinutes * 60 * 1000;
        LocalDate.temp = new Date();
    }

    static getFullYear(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        return LocalDate.temp.getUTCFullYear();
    }

    static getMonth(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        return LocalDate.temp.getUTCMonth();
    }

    static getDate(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        return LocalDate.temp.getUTCDate();
    }

    static getDay(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        return LocalDate.temp.getUTCDay();
    }

    static getHours(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        return LocalDate.temp.getUTCHours();
    }

    static getMinutes(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        return LocalDate.temp.getUTCMinutes();
    }

    static getSeconds(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        return LocalDate.temp.getUTCSeconds();
    }

    static daysBetween(from, to) {
        const fromTm = from.getTime() + LocalDate.timezoneOffset;
        const toTm = to.getTime() + LocalDate.timezoneOffset;

        const fromDay = Math.floor(fromTm / (60 * 60 * 24 * 1000));
        const toDay = Math.floor(toTm / (60 * 60 * 24 * 1000));
        const days = toDay - fromDay;
        return days;
    }

    static toString(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        return LocalDate.temp.toUTCString();
    }

    static toISOStringNZ(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        const isoString = sprintf('%d-%02d-%02dT%02d:%02d:%02d',
            LocalDate.temp.getUTCFullYear(), LocalDate.temp.getUTCMonth() + 1, LocalDate.temp.getUTCDate(),
            LocalDate.temp.getUTCHours(), LocalDate.temp.getUTCMinutes(), LocalDate.temp.getUTCSeconds());
        return isoString;
    }

    static toISOString(date) {
        const timestamp = date.getTime() + LocalDate.timezoneOffset;
        LocalDate.temp.setTime(timestamp);
        const isoString = sprintf('%d-%02d-%02dT%02d:%02d:%02dZ',
            LocalDate.temp.getUTCFullYear(), LocalDate.temp.getUTCMonth() + 1, LocalDate.temp.getUTCDate(),
            LocalDate.temp.getUTCHours(), LocalDate.temp.getUTCMinutes(), LocalDate.temp.getUTCSeconds());
        return isoString;
    }

    static elapsedDays(date) {
        return Math.floor((date.getTime() + LocalDate.timezoneOffset) / (60 * 60 * 24 * 1000));
    }

    static dateAtElapsed(index) {
        return new Date(index * 60 * 60 * 24 * 1000 - LocalDate.timezoneOffset);
    }

    static nextDate(date) {
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);
        return nextDate;
    }
}

function main() {
    LocalDate.setTimezoneOffset(9 * 60);
    const date = new Date();
    console.log(LocalDate.getFullYear(date));
    console.log(LocalDate.getMonth(date));
    console.log(LocalDate.getDate(date));
    console.log(LocalDate.getDay(date));
    console.log(LocalDate.getHours(date));
    console.log(LocalDate.getMinutes(date));
    console.log(LocalDate.getSeconds(date));
    const startTime = new Date().getTime();
    for (let i = 0; i < 1000000; ++i) {
        LocalDate.getFullYear(date);
        LocalDate.getMonth(date);
        LocalDate.getDate(date);
        LocalDate.getDay(date);
        LocalDate.getHours(date);
        LocalDate.getMinutes(date);
        LocalDate.getSeconds(date);
    }
    const endTime = new Date().getTime();
    console.log(`Elapsed Time = ${(endTime - startTime) / 1000}`);
}

// main();

module.exports = LocalDate;