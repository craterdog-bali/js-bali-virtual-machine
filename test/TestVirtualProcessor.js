/************************************************************************
 * Copyright (c) Crater Dog Technologies(TM).  All Rights Reserved.     *
 ************************************************************************
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.        *
 *                                                                      *
 * This code is free software; you can redistribute it and/or modify it *
 * under the terms of The MIT License (MIT), as published by the Open   *
 * Source Initiative. (See http://opensource.org/licenses/MIT)          *
 ************************************************************************/

const debug = 1;  // set to true for error logging
const directory = 'test/config/';
const pfs = require('fs').promises;
const mocha = require('mocha');
const expect = require('chai').expect;
const bali = require('bali-component-framework').api(debug);
const account = bali.component('#GTDHQ9B8ZGS7WCBJJJBFF6KDCCF55R2P');
const notary = require('bali-digital-notary').test(account, directory, debug);
const Repository = require('bali-document-repository');
const storage = Repository.test(notary, directory, debug);
const repository = Repository.repository(notary, storage, debug);
const compiler = require('bali-type-compiler').api(debug);
const vm = require('../index').api(repository, debug);
const EOL = '\n';  // POSIX end of line character
const TASK_BAG = '/bali/vm/tasks/v1';
const EVENT_BAG = '/bali/vm/events/v1';
const MESSAGE_BAG = '/bali/vm/messages/v1';

const getInstruction = function(processor) {
    const instruction = processor.getContext().getInstruction();
    return compiler.string(instruction).split(' ').slice(0, 2).join(' ');
};

describe('Bali Virtual Machine™', function() {

    describe('Initialize the environment', function() {

        it('should generate the notary key and publish its certificate', async function() {
            const publicKey = await notary.generateKey();
            const certificate = await notary.notarizeDocument(publicKey);
            const citation = await notary.activateKey(certificate);
            expect(citation.isEqualTo(await storage.writeDocument(certificate))).is.true;
        });

        it('should create the task bag in the repository', async function() {
            const taskBag = await notary.notarizeDocument(bali.catalog({
                $description: '"This is the task bag for the VM."'
            }, {
                $type: '/bali/collections/Bag/v1',
                $tag: bali.tag(),
                $version: bali.version(),
                $permissions: '/bali/permissions/public/v1',
                $previous: bali.pattern.NONE
            }));
            const bagCitation = await storage.writeDocument(taskBag);
            await storage.writeName(TASK_BAG, bagCitation);
        });

        it('should create the event bag in the repository', async function() {
            const eventBag = await notary.notarizeDocument(bali.catalog({
                $description: '"This is the event bag for the VM."'
            }, {
                $type: '/bali/collections/Bag/v1',
                $tag: bali.tag(),
                $version: bali.version(),
                $permissions: '/bali/permissions/public/v1',
                $previous: bali.pattern.NONE
            }));
            const bagCitation = await storage.writeDocument(eventBag);
            await storage.writeName(EVENT_BAG, bagCitation);
        });

        it('should create the message bag in the repository', async function() {
            const messageBag = await notary.notarizeDocument(bali.catalog({
                $description: '"This is the message bag for the VM."'
            }, {
                $type: '/bali/collections/Bag/v1',
                $tag: bali.tag(),
                $version: bali.version(),
                $permissions: '/bali/permissions/public/v1',
                $previous: bali.pattern.NONE
            }));
            const bagCitation = await storage.writeDocument(messageBag);
            await storage.writeName(MESSAGE_BAG, bagCitation);
        });

    });

    describe('Test all VM instructions', function() {

        it('should compile example type documents into compiled type documents', async function() {
            const testFolder = 'test/examples/';
            const files = await pfs.readdir(testFolder);
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (!file.endsWith('.bali')) continue;

                // compile the type
                console.log('      ' + file);
                const prefix = file.split('.').slice(0, 1);
                const typeFile = testFolder + prefix + '.bali';
                var source = await pfs.readFile(typeFile, 'utf8');
                const type = bali.component(source, debug);
                expect(type).to.exist;
                compiler.compileType(type);

                // check for differences
                source = type.toString() + '\n';  // POSIX compliant <EOL>
                //await pfs.writeFile(typeFile, source, 'utf8');
                const expected = await pfs.readFile(typeFile, 'utf8');
                expect(expected).to.exist;
                expect(source).to.equal(expected);

                // publish the type in the repository
                var name = '/bali/types/' + prefix + '/v1';
                await repository.commitDocument(name, type);

                // publish an instance of the type in the repository
                const instance = bali.instance(name, {});
                name = '/bali/instances/' + prefix + '/v1';
                await repository.commitDocument(name, instance);
            }
        });

        it('should cause the VM to step through the test type "good" route successfully', async function() {
            const tokens = bali.number(100);
            const target = await repository.retrieveDocument('/bali/instances/Test/v1');
            const message = bali.symbol('test1');
            const args = bali.list(['"good"']);
            const processor = vm.processor();
            expect(processor).to.exist;
            await processor.newTask(account, tokens, target, message, args);
//          1.EvaluateStatement:
//          PUSH HANDLER 1.EvaluateStatementHandler
            expect(getInstruction(processor)).to.equal('PUSH HANDLER');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getContext().hasHandlers()).to.equal(true);
//          PUSH ARGUMENT $target
            expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $list
            expect(getInstruction(processor)).to.equal('CALL $list');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PUSH ARGUMENT $argument
            expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $addItem WITH 2 ARGUMENTS
            expect(getInstruction(processor)).to.equal('CALL $addItem');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          SEND $test3 TO COMPONENT WITH ARGUMENTS
            expect(getInstruction(processor)).to.equal('SEND 2');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
            expect(processor.getTask().hasContexts()).to.equal(true);
//              1.ThrowStatement:
//              PUSH ARGUMENT $text
                expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              PULL EXCEPTION
                expect(getInstruction(processor)).to.equal('PULL EXCEPTION');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
                expect(processor.getTask().hasContexts()).to.equal(false);
//          1.EvaluateStatementHandler:
//          SAVE VARIABLE $exception
            expect(getInstruction(processor)).to.equal('SAVE VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.1.HandleBlock:
//          LOAD VARIABLE $exception
            expect(getInstruction(processor)).to.equal('LOAD VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PUSH LITERAL `"good"`
            expect(getInstruction(processor)).to.equal('PUSH LITERAL');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $doesMatch WITH 2 ARGUMENTS
            expect(getInstruction(processor)).to.equal('CALL $doesMatch');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          JUMP TO 1.2.HandleBlock ON FALSE
            expect(getInstruction(processor)).to.equal('JUMP TO');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.1.1.EvaluateStatement:
//          PUSH CONSTANT $document
            expect(getInstruction(processor)).to.equal('PUSH CONSTANT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          SEND $test2 TO DOCUMENT
            expect(getInstruction(processor)).to.equal('SEND 1');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          SAVE VARIABLE $result-1
            expect(getInstruction(processor)).to.equal('SAVE VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.1.2.ReturnStatement:
//          PUSH CONSTANT $good
            expect(getInstruction(processor)).to.equal('PUSH CONSTANT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PULL RESULT
            expect(getInstruction(processor)).to.equal('PULL RESULT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
            expect(processor.getTask().getState().toString()).to.equal('$completed');
            expect(await processor.stepClock()).to.equal(false);
        });

        it('should cause the VM to step through the test type "bad" route successfully', async function() {
            const tokens = bali.number(100);
            const target = await repository.retrieveDocument('/bali/instances/Test/v1');
            const message = bali.symbol('test1');
            const args = bali.list(['"bad"']);
            const processor = vm.processor();
            expect(processor).to.exist;
            await processor.newTask(account, tokens, target, message, args);
//          1.EvaluateStatement:
//          PUSH HANDLER 1.EvaluateStatementHandler
            expect(getInstruction(processor)).to.equal('PUSH HANDLER');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getContext().hasHandlers()).to.equal(true);
//          PUSH ARGUMENT $target
            expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $list
            expect(getInstruction(processor)).to.equal('CALL $list');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PUSH ARGUMENT $argument
            expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $addItem WITH 2 ARGUMENTS
            expect(getInstruction(processor)).to.equal('CALL $addItem');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          SEND $test3 TO COMPONENT WITH ARGUMENTS
            expect(getInstruction(processor)).to.equal('SEND 2');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
            expect(processor.getTask().hasContexts()).to.equal(true);
//              1.ThrowStatement:
//              PUSH ARGUMENT $text
                expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              PULL EXCEPTION
                expect(getInstruction(processor)).to.equal('PULL EXCEPTION');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
                expect(processor.getTask().hasContexts()).to.equal(false);
//          1.EvaluateStatementHandler:
//          SAVE VARIABLE $exception
            expect(getInstruction(processor)).to.equal('SAVE VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.1.HandleBlock:
//          LOAD VARIABLE $exception
            expect(getInstruction(processor)).to.equal('LOAD VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PUSH LITERAL `"good"`
            expect(getInstruction(processor)).to.equal('PUSH LITERAL');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $doesMatch WITH 2 ARGUMENTS
            expect(getInstruction(processor)).to.equal('CALL $doesMatch');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          JUMP TO 1.2.HandleBlock ON FALSE
            expect(getInstruction(processor)).to.equal('JUMP TO');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.2.HandleBlock:
//          LOAD VARIABLE $exception
            expect(getInstruction(processor)).to.equal('LOAD VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PUSH LITERAL `"bad"`
            expect(getInstruction(processor)).to.equal('PUSH LITERAL');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $doesMatch WITH 2 ARGUMENTS
            expect(getInstruction(processor)).to.equal('CALL $doesMatch');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          JUMP TO 1.EvaluateStatementFailed ON FALSE
            expect(getInstruction(processor)).to.equal('JUMP TO');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.2.1.EvaluateStatement:
//          PUSH ARGUMENT $target
            expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          SEND $test2 TO COMPONENT
            expect(getInstruction(processor)).to.equal('SEND 1');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
            expect(processor.getTask().hasContexts()).to.equal(true);
//              1.ReturnStatement:
//              PUSH LITERAL `none`
                expect(getInstruction(processor)).to.equal('PUSH LITERAL');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              CALL $catalog
                expect(getInstruction(processor)).to.equal('CALL $catalog');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              PUSH LITERAL `$type`
                expect(getInstruction(processor)).to.equal('PUSH LITERAL');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              PUSH LITERAL `/bali/collections/Set/v1`
                expect(getInstruction(processor)).to.equal('PUSH LITERAL');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              CALL $setValue WITH 3 ARGUMENTS
                expect(getInstruction(processor)).to.equal('CALL $setValue');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              CALL $set WITH 2 ARGUMENTS
                expect(getInstruction(processor)).to.equal('CALL $set');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              PUSH LITERAL `"alpha"`
                expect(getInstruction(processor)).to.equal('PUSH LITERAL');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              CALL $addItem WITH 2 ARGUMENTS
                expect(getInstruction(processor)).to.equal('CALL $addItem');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              PULL RESULT
                expect(getInstruction(processor)).to.equal('PULL RESULT');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
                expect(processor.getTask().hasContexts()).to.equal(false);
//          SAVE VARIABLE $result-1
            expect(getInstruction(processor)).to.equal('SAVE VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.2.HandleBlockDone:
//          JUMP TO 1.EvaluateStatementSucceeded
            expect(getInstruction(processor)).to.equal('JUMP TO');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.EvaluateStatementSucceeded:
//          SKIP INSTRUCTION
            expect(getInstruction(processor)).to.equal('SKIP INSTRUCTION');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);

//          2.EvaluateStatement:
//          PUSH CONSTANT $document
            expect(getInstruction(processor)).to.equal('PUSH CONSTANT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $list
            expect(getInstruction(processor)).to.equal('CALL $list');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PUSH ARGUMENT $argument
            expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $addItem WITH 2 ARGUMENTS
            expect(getInstruction(processor)).to.equal('CALL $addItem');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          SEND $test3 TO DOCUMENT WITH ARGUMENTS
            expect(getInstruction(processor)).to.equal('SEND 2');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          SAVE VARIABLE $result-1
            expect(getInstruction(processor)).to.equal('SAVE VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);

//          3.ReturnStatement:
//          PUSH CONSTANT $good
            expect(getInstruction(processor)).to.equal('PUSH CONSTANT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $not WITH 1 ARGUMENT
            expect(getInstruction(processor)).to.equal('CALL $not');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PULL RESULT
            expect(getInstruction(processor)).to.equal('PULL RESULT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
            expect(processor.getTask().getState().toString()).to.equal('$completed');
            expect(await processor.stepClock()).to.equal(false);
        });

        it('should cause the VM to step through the test type "ugly" route successfully', async function() {
            const tokens = bali.number(100);
            const target = await repository.retrieveDocument('/bali/instances/Test/v1');
            const message = bali.symbol('test1');
            const args = bali.list([]);
            const processor = vm.processor();
            expect(processor).to.exist;
            await processor.newTask(account, tokens, target, message, args);
//          1.EvaluateStatement:
//          PUSH HANDLER 1.EvaluateStatementHandler
            expect(getInstruction(processor)).to.equal('PUSH HANDLER');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getContext().hasHandlers()).to.equal(true);
//          PUSH ARGUMENT $target
            expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $list
            expect(getInstruction(processor)).to.equal('CALL $list');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PUSH ARGUMENT $argument
            expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $addItem WITH 2 ARGUMENTS
            expect(getInstruction(processor)).to.equal('CALL $addItem');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          SEND $test3 TO COMPONENT WITH ARGUMENTS
            expect(getInstruction(processor)).to.equal('SEND 2');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
            expect(processor.getTask().hasContexts()).to.equal(true);
//              1.ThrowStatement:
//              PUSH ARGUMENT $text
                expect(getInstruction(processor)).to.equal('PUSH ARGUMENT');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
//              PULL EXCEPTION
                expect(getInstruction(processor)).to.equal('PULL EXCEPTION');
                expect(await processor.stepClock()).to.equal(true);
                expect(processor.getTask().hasComponents()).to.equal(true);
                expect(processor.getTask().hasContexts()).to.equal(false);
//          1.EvaluateStatementHandler:
//          SAVE VARIABLE $exception
            expect(getInstruction(processor)).to.equal('SAVE VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.1.HandleBlock:
//          LOAD VARIABLE $exception
            expect(getInstruction(processor)).to.equal('LOAD VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PUSH LITERAL `"good"`
            expect(getInstruction(processor)).to.equal('PUSH LITERAL');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $doesMatch WITH 2 ARGUMENTS
            expect(getInstruction(processor)).to.equal('CALL $doesMatch');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          JUMP TO 1.2.HandleBlock ON FALSE
            expect(getInstruction(processor)).to.equal('JUMP TO');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.2.HandleBlock:
//          LOAD VARIABLE $exception
            expect(getInstruction(processor)).to.equal('LOAD VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PUSH LITERAL `"bad"`
            expect(getInstruction(processor)).to.equal('PUSH LITERAL');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          CALL $doesMatch WITH 2 ARGUMENTS
            expect(getInstruction(processor)).to.equal('CALL $doesMatch');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          JUMP TO 1.EvaluateStatementFailed ON FALSE
            expect(getInstruction(processor)).to.equal('JUMP TO');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
//          1.EvaluateStatementFailed:
//          LOAD VARIABLE $exception
            expect(getInstruction(processor)).to.equal('LOAD VARIABLE');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(true);
//          PULL EXCEPTION
            expect(getInstruction(processor)).to.equal('PULL EXCEPTION');
            expect(await processor.stepClock()).to.equal(true);
            expect(processor.getTask().hasComponents()).to.equal(false);
            expect(processor.getTask().getState().toString()).to.equal('$abandoned');
            expect(await processor.stepClock()).to.equal(false);
        });

    });

});
