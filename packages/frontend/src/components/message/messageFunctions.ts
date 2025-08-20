import moment from 'moment'

import { getLogger } from '../../../../shared/logger'
import { runtime } from '@deltachat-desktop/runtime-interface'
import { BackendRemote, Type } from '../../backend-com'
import { selectedAccountId } from '../../ScreenController'
import { internalOpenWebxdc } from '../../system-integration/webxdc'
import ForwardMessage from '../dialogs/ForwardMessage'
import ConfirmationDialog from '../dialogs/ConfirmationDialog'
import MessageDetail from '../dialogs/MessageDetail/MessageDetail'
import SecurePDFViewer from '../dialogs/SecurePDFViewer'
import SecureImageViewer from '../dialogs/SecureImageViewer'
import SecureVideoViewer from '../dialogs/SecureVideoViewer'

import type { OpenDialog } from '../../contexts/DialogContext'
import { C, type T } from '@deltachat/jsonrpc-client'
import ConfirmDeleteMessageDialog from '../dialogs/ConfirmDeleteMessage'
import { basename, dirname, extname } from 'path'
import { json } from 'stream/consumers'
import {
  PRV_APP_STATUS_SEND_PEER_PDU,
  PRV_EVENT_ADD_NEW_PEER,
} from '../../../../target-electron/src/privitty/privitty_type'

const log = getLogger('render/msgFunctions')

/**
 * json representation of the message object we get from the backend
 */
export function onDownload(msg: Type.Message) {
  if (!msg.file) {
    log.error('message has no file to download:', msg)
    throw new Error('message has no file to download')
  } else if (!msg.fileName) {
    log.error('message has no filename to download:', msg)
    throw new Error('message has no file name to download')
  } else {
    runtime.downloadFile(msg.file, msg.fileName)
  }
}

interface OpenAttachmentResult {
  useSecureViewer?: boolean
  filePath?: string
  fileName?: string
  viewerType?: string
}

export async function openAttachmentInShell(msg: Type.Message): Promise<OpenAttachmentResult | void> {
  if (!msg.file || !msg.fileName) {
    log.error('message has no file to open:', msg)
    throw new Error('message has no file to open')
  }
  let tmpFile: string
  try {
    tmpFile = await runtime.copyFileToInternalTmpDir(msg.fileName, msg.file)
    log.info('File copied to tmp dir', { originalFile: msg.file, tmpFile })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('Failed to copy file to temp directory', { 
      originalFile: msg.file, 
      fileName: msg.fileName, 
      error: errorMessage 
    })
    
    // Show user-friendly error message
    runtime.showNotification({
      title: 'File Error',
      body: 'The file could not be opened because it is no longer available. It may have been deleted or moved.',
      icon: null,
      chatId: msg.chatId,
      messageId: msg.id,
      accountId: selectedAccountId(),
      notificationType: 0,
    })
    
    throw new Error('File is no longer available')
  }
  
  let filePathName = tmpFile
  if (extname(msg.fileName) === '.prv') {
    filePathName = tmpFile.replace(/\\/g, '/')
    const response = await runtime.PrivittySendMessage('decryptFile', {
      chatId: msg.chatId,
      filePath: dirname(filePathName),
      fileName: msg.fileName,
      direction: msg.fromId === C.DC_CONTACT_ID_SELF ? 1 : 0,
    })
    console.log('decryptFile response:', response)
    filePathName = JSON.parse(JSON.parse(response).result).decryptedFile
    console.log('decrypted file path:', filePathName)
    if (filePathName === 'SPLITKEYS_EXPIRED') {
      runtime.showNotification({
        title: 'Privitty',
        body: 'OTSP expired',
        icon: null,
        chatId: msg.chatId,
        messageId: msg.id,
        accountId: selectedAccountId(),
        notificationType: 0,
      })

      return
    } else if (filePathName === 'SPLITKEYS_REQUESTED') {
      runtime.showNotification({
        title: 'Privitty',
        body: 'OTSP already requested',
        icon: null,
        chatId: msg.chatId,
        messageId: msg.id,
        accountId: selectedAccountId(),
        notificationType: 0,
      })
      return
    }
    if (msg.fromId === C.DC_CONTACT_ID_SELF) {
      // we will open the viewer if the file is not downloadable
      //we will open the viewer if the file is not downloadable
      const fileAccessResponse = await runtime.PrivittySendMessage(
        'getFileAccessState',
        {
          chatId: msg.chatId,
          fileName: msg.fileName,
          outgoing: true,
        }
      )
      console.log('canDownloadFile response :', fileAccessResponse)
      const parsedResponse = JSON.parse(fileAccessResponse)
      if (JSON.parse(parsedResponse?.result).fileAccessState != 'revoked') {
        // Check if the decrypted file is a supported media type that should be opened in secure viewer
        const decryptedFileExtension = extname(filePathName).toLowerCase()
        const supportedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
        const supportedVideoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v']
        
        if (decryptedFileExtension === '.pdf' || supportedImageExtensions.includes(decryptedFileExtension) || supportedVideoExtensions.includes(decryptedFileExtension)) {
          log.info('Decrypted file is supported media, should be opened in secure viewer', { filePath: filePathName, fileName: msg.fileName, extension: decryptedFileExtension })
          // Return a result to indicate this should be opened in secure viewer
          return {
            useSecureViewer: true,
            filePath: filePathName,
            fileName: msg.fileName,
            viewerType: decryptedFileExtension === '.pdf' ? 'pdf' : 'media'
          }
        }
        runtime.openPath(filePathName)
        return
      }
    } else {
      //we will open the viewer if the file is not downloadable
      const fileAccessResponse = await runtime.PrivittySendMessage(
        'canDownloadFile',
        {
          chatId: msg.chatId,
          fileName: msg.fileName,
          outgoing: msg.fromId === C.DC_CONTACT_ID_SELF,
        }
      )
      console.log('canDownloadFile response :', fileAccessResponse)
      const parsedResponse = JSON.parse(fileAccessResponse)
      if (JSON.parse(parsedResponse?.result).status === 'false') {
        // Check if the decrypted file is a supported media type that should be opened in secure viewer
        const decryptedFileExtension = extname(filePathName).toLowerCase()
        const supportedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
        const supportedVideoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v']
        
        if (decryptedFileExtension === '.pdf' || supportedImageExtensions.includes(decryptedFileExtension) || supportedVideoExtensions.includes(decryptedFileExtension)) {
          log.info('Decrypted file is supported media, should be opened in secure viewer', { filePath: filePathName, fileName: msg.fileName, extension: decryptedFileExtension })
          // Return a result to indicate this should be opened in secure viewer
          return {
            useSecureViewer: true,
            filePath: filePathName,
            fileName: msg.fileName,
            viewerType: decryptedFileExtension === '.pdf' ? 'pdf' : 'media'
          }
        }
        //runtime.OpenSecureViewer(filePathName, filePathName)
        //runtime.openPath(filePathName)
        //return
        // Check if the decrypted file is a supported media type and use secure viewer
        const fileExtension = extname(filePathName).toLowerCase()
       

        if (fileExtension === '.pdf') {
          // For PDFs, we'll use the secure viewer dialog instead of opening in external app
          // This ensures the PDF data stays within the application
          log.info('Opening PDF in secure viewer', {
            filePath: filePathName,
            fileName: msg.fileName,
          })
          return {
            useSecureViewer: true,
            filePath: filePathName,
            fileName: msg.fileName,
            viewerType: 'pdf',
          }
        } else if (supportedImageExtensions.includes(fileExtension)) {
          // For images, use the secure image viewer
          log.info('Opening image in secure viewer', {
            filePath: filePathName,
            fileName: msg.fileName,
          })
          return {
            useSecureViewer: true,
            filePath: filePathName,
            fileName: msg.fileName,
            viewerType: 'image',
          }
        } else if (supportedVideoExtensions.includes(fileExtension)) {
          // For videos, use the secure video viewer
          log.info('Opening video in secure viewer', {
            filePath: filePathName,
            fileName: msg.fileName,
          })
          return {
            useSecureViewer: true,
            filePath: filePathName,
            fileName: msg.fileName,
            viewerType: 'video',
          }
        }
      }
    }
  }

  // For non-PDF files, use the original behavior
  if (!runtime.openPath(filePathName)) {
    log.info(
      "file couldn't be opened, try saving it in a different place and try to open it from there"
    )
  }
}

const privittyForwardable = async (message: T.Message): Promise<boolean> => {
  let isforwardable = true
  if (message.file) {
    isforwardable = false
    if (message.fromId === C.DC_CONTACT_ID_SELF) {
      // check if the file is forwardable
      const response = await runtime.PrivittySendMessage('getFileAccessState', {
        chatId: message.chatId,
        fileName: message.fileName,
        outgoing: true,
      })
      const result = JSON.parse(response)
      //"result":"{"fileAccessState":"active"}
      if (result) {
        isforwardable = JSON.parse(result.result).fileAccessState === 'active'
      }

      console.log('isforwardable:', isforwardable, result)
    } else {
      const response = await runtime.PrivittySendMessage('canForwardFile', {
        chatId: message.chatId,
        fileName: message.fileName,
        outgoing: message.fromId === C.DC_CONTACT_ID_SELF,
      })
      const result = JSON.parse(response)
      //"result":"{"fileAccessState":"active"}
      if (result) {
        isforwardable = JSON.parse(result.result).status === 'true'
      }
      console.log('isforwardable:', isforwardable, result)
    }
  }
  return isforwardable
}

export async function openForwardDialog(
  openDialog: OpenDialog,
  message: Type.Message
) {
  const forwardable = await privittyForwardable(message)
  try {
    if (!forwardable) {
      log.error('message has no file to forward:', message)
      // show notification
      runtime.showNotification({
        title: 'Privitty',
        body: 'File is not forwardable',
        icon: null,
        chatId: message.chatId,
        messageId: message.id,
        accountId: selectedAccountId(),
        notificationType: 0,
      })
      throw new Error('message has no file to forward')
    } else {
      openDialog(ForwardMessage, { message })
    }
  } catch (error) {
    // Handle any errors that may occur during the forward dialog opening
    log.error('Error opening forward dialog:', error)
  }
}

export function confirmDialog(
  openDialog: OpenDialog,
  message: string,
  confirmLabel: string,
  isConfirmDanger = false
): Promise<boolean> {
  return new Promise((res, _rej) => {
    openDialog(ConfirmationDialog, {
      message,
      confirmLabel,
      isConfirmDanger,
      cb: (yes: boolean) => {
        res(yes)
      },
    })
  })
}

export async function confirmForwardMessage(
  openDialog: OpenDialog,
  accountId: number,
  message: Type.Message,
  chat: Pick<Type.BasicChat, 'name' | 'id'>
) {
  const tx = window.static_translate
  const yes = await confirmDialog(
    openDialog,
    tx('ask_forward', [chat.name]),
    tx('forward')
  )
  if (yes) {
    if (message.file && message.fileName) {
      const result = await runtime.PrivittySendMessage(
        'isChatPrivittyProtected',
        {
          chatId: chat?.id,
        }
      )
      console.log('isChatPrivittyProtected response MenuAttachment', result)
      if (result) {
        try {
          const resp = JSON.parse(result)
          if (resp.result === 'false') {
            console.log(
              'accountid =',
              accountId,
              'chat.id =',
              chat.id,
              'chatName =',
              chat.name
            )
            const addpeerResponse = await runtime.PrivittySendMessage(
              'produceEvent',
              {
                eventType: PRV_EVENT_ADD_NEW_PEER,
                mID: '',
                mName: chat.name,
                msgId: chat.id,
                fromId: 0,
                chatId: chat.id,
                pCode: '',
                filePath: '',
                fileName: '',
                direction: 0,
                pdu: [],
              }
            )
            console.log('addpeerResponse =', addpeerResponse)
            const parsedResponse = JSON.parse(addpeerResponse)
            if (parsedResponse.message_type === PRV_APP_STATUS_SEND_PEER_PDU) {
              const base64Msg = btoa(
                String.fromCharCode.apply(null, parsedResponse.pdu)
              )
              const MESSAGE_DEFAULT: T.MessageData = {
                file: null,
                filename: null,
                viewtype: null,
                html: null,
                location: null,
                overrideSenderName: null,
                quotedMessageId: null,
                quotedText: null,
                text: null,
              }
              const message: Partial<T.MessageData> = {
                text: base64Msg,
                file: undefined,
                filename: undefined,
                quotedMessageId: null,
                viewtype: 'Text',
              }

              const msgId = await BackendRemote.rpc.sendMsgWithSubject(
                accountId,
                chat?.id || 0,
                {
                  ...MESSAGE_DEFAULT,
                  ...message,
                },
                "{'privitty':'true', 'type':'new_peer_add'}"
              )
            } else {
              runtime.showNotification({
                title: 'Privitty',
                body: 'Privitty ADD peer state =' + parsedResponse.message_type,
                icon: null,
                chatId: 0,
                messageId: 0,
                accountId,
                notificationType: 0,
              })
              return
            }
            runtime.showNotification({
              title: 'Privitty',
              body: 'Enabling Privitty security',
              icon: null,
              chatId: 0,
              messageId: 0,
              accountId,
              notificationType: 0,
            })
            return
          }
        } catch (e) {
          console.error('Error in MenuAttachment', e)
          return
        }
      }
      await BackendRemote.rpc.forwardMessages(accountId, [message.id], chat.id)
      //work around for privitty file forwarding create the temp
      const tmpFile = await runtime.copyFileToInternalTmpDir(
        message.fileName,
        message.file
      )
      let filePathName1 = tmpFile
      filePathName1 = tmpFile.replace(/\\/g, '/')

      //we need to send a split key to the peer
      const filePathName = message.file.replace(/\\/g, '/')
      const responseFwdPeerAdd = await runtime.PrivittySendMessage(
        'forwardPeerAdd',
        {
          sourceChatId: message.chatId,
          fwdToChatId: chat.id,
          fwdToName: chat.name,
          filePath: dirname(filePathName1),
          fileName: basename(filePathName1),
          outgoing: 1,
        }
      )
      const parsedResponse = JSON.parse(responseFwdPeerAdd)
      if (parsedResponse.message_type === PRV_APP_STATUS_SEND_PEER_PDU) {
        const base64Msg = btoa(
          String.fromCharCode.apply(null, parsedResponse.pdu)
        )
        const MESSAGE_DEFAULT: T.MessageData = {
          file: null,
          filename: null,
          viewtype: null,
          html: null,
          location: null,
          overrideSenderName: null,
          quotedMessageId: null,
          quotedText: null,
          text: null,
        }
        const message: Partial<T.MessageData> = {
          text: base64Msg,
          file: undefined,
          filename: undefined,
          quotedMessageId: null,
          viewtype: 'Text',
        }
        const msgId = await BackendRemote.rpc.sendMsgWithSubject(
          accountId,
          chat?.id || 0,
          {
            ...MESSAGE_DEFAULT,
            ...message,
          },
          "{'privitty':'true', 'type':'new_peer_add'}"
        )
      }
    } else {
      await BackendRemote.rpc.forwardMessages(accountId, [message.id], chat.id)
    }
    return yes
  }
}

export function confirmDeleteMessage(
  openDialog: OpenDialog,
  accountId: number,
  msg: Type.Message,
  chat: Type.FullChat
) {
  openDialog(ConfirmDeleteMessageDialog, {
    accountId,
    msg,
    chat,
  })
}

export function openMessageInfo(openDialog: OpenDialog, message: Type.Message) {
  openDialog(MessageDetail, { id: message.id })
}

export function openSecurePDFViewer(
  openDialog: OpenDialog,
  filePath: string,
  fileName: string
) {
  openDialog(SecurePDFViewer, { filePath, fileName })
}

export function openSecureImageViewer(
  openDialog: OpenDialog,
  filePath: string,
  fileName: string
) {
  openDialog(SecureImageViewer, { filePath, fileName })
}

export function openSecureVideoViewer(
  openDialog: OpenDialog,
  filePath: string,
  fileName: string
) {
  openDialog(SecureVideoViewer, { filePath, fileName })
}

export function openSecureViewer(
  openDialog: OpenDialog,
  filePath: string,
  fileName: string,
  viewerType: 'pdf' | 'image' | 'video'
) {
  switch (viewerType) {
    case 'pdf':
      openSecurePDFViewer(openDialog, filePath, fileName)
      break
    case 'image':
      openSecureImageViewer(openDialog, filePath, fileName)
      break
    case 'video':
      openSecureVideoViewer(openDialog, filePath, fileName)
      break
  }
}

export function setQuoteInDraft(messageId: number) {
  if (window.__setQuoteInDraft) {
    window.__setQuoteInDraft(messageId)
  } else {
    throw new Error('window.__setQuoteInDraft undefined')
  }
}
/**
 * @throws if the composer is not rendered.
 */
export function enterEditMessageMode(messageToEdit: T.Message) {
  if (window.__enterEditMessageMode) {
    window.__enterEditMessageMode(messageToEdit)
  } else {
    throw new Error('window.__enterEditMessageMode undefined')
  }
}

export async function openMessageHTML(messageId: number) {
  const accountId = selectedAccountId()
  const content = await BackendRemote.rpc.getMessageHtml(accountId, messageId)
  if (!content) {
    log.error('openMessageHTML, message has no html content', { messageId })
    return
  }
  const {
    sender: { displayName },
    subject,
    chatId,
    receivedTimestamp,
  } = await BackendRemote.rpc.getMessage(accountId, messageId)
  const receiveTime = moment(receivedTimestamp * 1000).format('LLLL')
  const { isContactRequest, isProtectionBroken } =
    await BackendRemote.rpc.getBasicChatInfo(accountId, chatId)
  runtime.openMessageHTML(
    accountId,
    messageId,
    isContactRequest || isProtectionBroken,
    subject,
    displayName,
    receiveTime,
    content
  )
}

export async function downloadFullMessage(messageId: number) {
  await BackendRemote.rpc.downloadFullMessage(selectedAccountId(), messageId)
}

export async function openWebxdc(message: Type.Message) {
  const accountId = selectedAccountId()
  internalOpenWebxdc(accountId, message)
}
