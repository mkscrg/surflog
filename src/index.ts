import { Request, Response } from 'express';
import { Bucket } from '@google-cloud/storage';
import Storage = require('@google-cloud/storage');
import { DateTime, Duration } from 'luxon';
import fetch from 'node-fetch';
import * as queryString from 'query-string';


type Handler = (req: Request, res: Response) => Promise<void>;

const logErrorAnd500 = (h: Handler): Handler =>
    async (req, res) => {
    try {
        await h(req, res);
        return;
    } catch (e) {
        console.error(e.stack);
        res.type('text/plain').status(500).send(e.stack);
    }
};


const resources = [
    "tides",
    "conditions",
    "wind",
    "weather",
    "wave",
];

const staticResourceParams = {
    days: 6,
    intervalHours: 3,
}

// read a single resource from the Surfline API
const getResource = async (
    resource: string,
    spotId: string,
): Promise<{}> => {
    const params = queryString.stringify({spotId, ...staticResourceParams});
    const resourceUrl = `https://services.surfline.com/kbyg/spots/forecasts/${resource}?${params}`;

    console.log(`GET ${resourceUrl}`);
    const response = await fetch(resourceUrl);
    if (response.status !== 200) {
        throw new Error(`Non-200 response from GET ${resourceUrl}`);
    }
    return response.json();
};

// read all resources, join in a single object, write to GCS bucket
const fetchResources = async (
    spotName: string,
    spotId: string,
    bucket: Bucket,
    dateTime: DateTime,
): Promise<void> => {
    console.log(`Getting ${resources.join(',')} for ${spotName}`);
    const results = await Promise.all(resources.map(r => getResource(r, spotId)));

    const forecast: {[key:string]: {}} = {};
    for (let i = 0; i < resources.length; ++i) {
        forecast[resources[i]] = results[i];
    }

    const timestamp = dateTime.toISO({ suppressSeconds: true, suppressMilliseconds: true });
    const file = bucket.file(`${spotName}/${timestamp}.json`);

    console.log(`Writing forecast for ${spotName} to gs://${bucket.name}/${file.name}`);
    await file.save(JSON.stringify(forecast));
};

const bucketName = 'surflog-forecasts';

// floor current time to last 5AM/5PM in UTC-8, format as ISO
const floorTime = (): DateTime => {
    const now = DateTime.utc();
    return now.minus(Duration.fromObject({
        // UTC 13 is UTC-8 5AM, UTC 1 is UTC-8 5PM
        hours: now.hour >= 13 ? now.hour - 13
            : now.hour < 1 ? now.hour + 24 - 13
            : now.hour - 1,
        minutes: now.minute,
        seconds: now.second,
        milliseconds: now.millisecond,
    }));
};

export const fetchSpot = logErrorAnd500(
    async (request: Request, response: Response): Promise<void> => {
        const { name, id } = request.query;
        if (name == null || id == null) {
            console.error('Missing required query params');
            response.type('text/plain').status(400).send('Required params: \'name\', \'id\'');
            return;
        }

        const dateTime = floorTime();

        const storage = Storage();
        const bucket = storage.bucket(bucketName);

        await fetchResources(name, id, bucket, dateTime);

        response.type('text/plain').status(200).send('OK');
    }
);
