import { Command, program } from 'commander';
import { version } from '../package.json';

import { Request } from './lib/request';
import { DOCHandler } from './lib/docs';

program
    .version(version, '-v,--version')
    .command('get [url]')
    .action(async function (url: string, options: Record<string,any>) {
        const docs = await Request.request(url).getAsync();
        const handler = DOCHandler.from(
            docs,
            options.dir
        );
        handler.resolveAPI();
        handler.resolveSchemas();
        handler.resolveCommon();
    })
    .option('-d,--dir [path]', 'custom directory to save API code to', './');

program.parse(process.argv);
