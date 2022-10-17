import axios from 'axios';
import fs from 'fs/promises';
import { OpenAPIObject } from 'openapi3-ts';

export class Request {
    private _url: string;
    constructor(url: string) {
        this._url = url;
    }

    static request(url: string) {
        return new Request(url);
    }

    __isUrl(url: string) {
        return url.startsWith('http://') || url.startsWith('https://');
    }

    async getAsync(): Promise<OpenAPIObject> {
        if (!this.__isUrl(this._url)) {
            let buffer = await fs.readFile(this._url, {
                encoding: 'utf-8',
                flag: 'r',
            });
            return JSON.parse(buffer) as OpenAPIObject;
        } else {
            let instance = axios.create();
            let res = await instance.get(this._url, {
                responseType: 'json',
            });
            return res.data as OpenAPIObject;
        }
    }
}
