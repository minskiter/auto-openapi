import { Command, program } from 'commander';
import { version } from '../package.json';

import { Request } from './lib/request';
import { DOCHandler } from './lib/docs';

program
    .version(version, '-v,--version')
    .command('get [url]')
    .action(async function (url: string, program: Command) {
        const docs = await Request.request(url).getAsync();
        DOCHandler.from(docs).resolveSchemas();
    });

program.parse(process.argv);
