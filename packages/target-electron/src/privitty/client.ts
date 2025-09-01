import { resolve, join } from 'path'
import { getLogger } from '@deltachat-desktop/shared/logger'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { getLogsPath } from '../application-constants'
import { arch, platform } from 'os'
import { app, dialog } from 'electron/main'

import * as T from '@deltachat/jsonrpc-client/dist/generated/types.js'
// import { Credentials } from '../../../frontend/src/types-app'
// import { BackendRemote } from '../../../frontend/src/backend-com'
const log = getLogger('Privitty')

import { PRV_EVENT_CREATE_VAULT } from './privitty_type'

export class PrivittyServer {
  // Get absolute path of the C++ binary
  _cmd_path = ''

  serverProcess: ChildProcessWithoutNullStreams | null
  constructor(
    public on_data: (reponse: string) => void,
    public accounts_path: string,
    private cmd_path: string
  ) {
    console.log('inside constructor')
    this.serverProcess = null
    // Compute default path now so error dialogs show a helpful location
    this.cmd_path = this.computeCmdPath()
  }

  private computeCmdPath() {
    const binName = process.platform === 'win32'
      ? 'privitty_jsonrpc_server.exe'
      : 'privitty_jsonrpc_server'

    // In packaged apps, extraResources are placed under process.resourcesPath
    if (app.isPackaged) {
      return join(process.resourcesPath, 'privitty', 'dll', binName)
    }

    // In dev, resolve from the repo's privitty/dll folder
    const appRoot = app.getAppPath()
    return resolve(appRoot, 'privitty/dll', binName)
  }

  start() {
    console.log('Privitty Start Invoked')
    // Resolve path at start to reflect packaged vs dev
    this._cmd_path = this.computeCmdPath()
    this.serverProcess = spawn(this._cmd_path, {
      env: {
        // DC_ACCOUNTS_PATH: this.accounts_path,
        RUST_LOG: process.env.RUST_LOG,
      },
    })

    this.serverProcess.on('error', err => {
      // The 'error' event is emitted whenever:
      // - The process could not be spawned.
      // - The process could not be killed.
      // - Sending a message to the child process failed.
      // - The child process was aborted via the signal option.
      // ~ https://nodejs.org/api/child_process.html#event-error

      if (err.message.endsWith('ENOENT')) {
        dialog.showErrorBox(
          'Fatal Error: Privitty Library Missing',
          `The Privitty Module is missing! This could be due to your antivirus program. Please check the quarantine to restore it and notify the developers about this issue.
            You can reach us at 
            
            The missing module should be located at "${this.cmd_path}".
            
            The Log file is located in this folder: ${getLogsPath()}
            --------------------
            Error: ${err.message}
            `
        )
      } else {
        dialog.showErrorBox(
          'Fatal Error',
          `Error with Privitty has been detected, please contact developers: You can reach us on  .
  
            ${err.name}: ${err.message}
  
            The Log file is located in this folder: ${getLogsPath()}\n
            `
        )
      }
      // I think we can exit in all the cases, because all errors here are serious
      app.exit(1)
    })

    let buffer = ''
    this.serverProcess.stdout.on('data', data => {
      // console.log(`stdout: ${data}`)
      buffer += data.toString()
      while (buffer.includes('\n')) {
        const n = buffer.indexOf('\n')
        const message = buffer.substring(0, n)
        console.log('Privitty client message', message)
        this.on_data(message)
        buffer = buffer.substring(n + 1)
      }
    })

    // some kind of "buffer" that the text in the error dialog does not get too long
    let errorLog = ''
    const ERROR_LOG_LENGTH = 800
    this.serverProcess.stderr.on('data', data => {
      console.log(`privitty client stderr: ${data}`.trimEnd())
      errorLog = (errorLog + data).slice(-ERROR_LOG_LENGTH)
    })

    this.serverProcess.on('close', (code, signal) => {
      if (code !== null) {
        log.info(`child process close all stdio with code ${code}`)
      } else {
        log.info(`child process close all stdio with signal ${signal}`)
      }
    })

    this.serverProcess.on('exit', (code, signal) => {
      if (code !== null) {
        log.info(`child process exited with code ${code}`)
        if (code !== 0) {
          log.critical('Fatal: The Delta Chat Core exited unexpectedly', code)
          dialog.showErrorBox(
            'Fatal Error',
            `[privitty Version: ${
              '1.0'
              //BuildInfo.VERSION
            } | ${platform()} | ${arch()}]\nThe privitty lib has exited unexpectedly with code ${code}\n${errorLog}`
          )
          app.exit(1)
        }
      } else {
        log.warn(`child process exited with signal ${signal}`)
      }
    })
  }

  send(message: string) {
    console.log('Privitty client Request send ', message)
    this.serverProcess?.stdin.write(message + '\n')
  }

  sendJsonRpcRequest(method: string, requestId: number, params: any) {
    const request = JSON.stringify({
      jsonrpc: '2.0',
      method,
      seqno: requestId,
      params,
    })
    console.log('Privitty client JSON Request send ', request)
    this.serverProcess?.stdin.write(request + '\n')
  }

  // Function to send JSON-RPC requests
  sendJsonRpcRequestWOP(method: string, requestId: number) {
    const request = JSON.stringify({ jsonrpc: '2.0', method, seqNo: requestId })
    console.log('Privitty client WOP Request send ', request)
    this.serverProcess?.stdin.write(request + '\n')
  }

  createVault(
    accountID: T.U32,
    userName: string,
    addr: string,
    mail_pw: string,
    requestId: number
  ) {
    this.sendJsonRpcRequest('produceEvent', requestId, {
      eventType: PRV_EVENT_CREATE_VAULT,
      mID: /*accountSettings.*/ addr, //"sender@privittytech.com",
      mName: userName, //"Alice",
      msgId: 0,
      fromId: 0,
      chatId: 0,
      pCode: /*accountSettings.*/ mail_pw, //"Crossroad",
      filePath: '',
      fileName: '',
      direction: 0,
      pdu: [],
    })
  }
}

// const binaryPath = resolve("./dll/", "privitty_jsonrpc_server");
// // Spawn the C++ JSON-RPC server
// const serverProcess = spawn(binaryPath);

// // Listen for responses from C++ server
// serverProcess.stdout.on("data", (data) => {
//     const messages: string[] = data.toString().trim().split("\n");

//     messages.forEach((message: string) => {
//         try {
//             if (!message.startsWith("{")) {
//                 console.warn("Skipping non-JSON message:", message);
//                 return; // Ignore non-JSON output
//             }

//             const json = JSON.parse(message);

//             if (json.method === "onEvent") {
//                 console.log("🔔 Async Event:", json.params);
//             } else {
//                 console.log("✅ Response from C++:", json);
//             }
//         } catch (error) {
//             console.error("❌ Error parsing JSON:", error);
//         }
//     });
// });

// // Handle errors
// serverProcess.stderr.on("data", (data) => {
//     console.error("Error:", data.toString());
// });

// function sendJsonRpcRequest(method: string, params: any) {
//     const request = JSON.stringify({ jsonrpc: "2.0", method, params});
//     serverProcess.stdin.write(request + "\n");
// }

// // Function to send JSON-RPC requests
// function sendJsonRpcRequestWOP(method: string) {
//     const request = JSON.stringify({ jsonrpc: "2.0", method});
//     serverProcess.stdin.write(request + "\n");
// }

// // Send JSON-RPC requests
// sendJsonRpcRequestWOP("version");
// sendJsonRpcRequestWOP("startEventLoop");
// sendJsonRpcRequest("produceEvent", {
//     eventType: 1,
//     mID: "sender@privittytech.com",
//     mName: "Alice",
//     msgId: 123,
//     fromId: 7,
//     chatId: 12,
//     pCode: "Crossroad",
//     filePath: "",
//     fileName: "",
//     direction: 0,
//     pdu: ""
// });
// sendJsonRpcRequest("encryptFile", {
//     chatId: 12,
//     filePath: "/path/to/file",
//     fileName: "abc.pdf"
// });
// sendJsonRpcRequestWOP("stopConsumer");
