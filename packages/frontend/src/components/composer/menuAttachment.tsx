import React, { useCallback, useContext } from 'react'
import { dirname, basename, normalize } from 'path'

import { runtime } from '@deltachat-desktop/runtime-interface'
import { useStore } from '../../stores/store'
import SettingsStoreInstance from '../../stores/settings'
import { IMAGE_EXTENSIONS } from '../../../../shared/constants'
import useConfirmationDialog from '../../hooks/dialog/useConfirmationDialog'
import useTranslationFunction from '../../hooks/useTranslationFunction'
import useDialog from '../../hooks/dialog/useDialog'
import SelectContactDialog from '../dialogs/SelectContact'
import useVideoChat from '../../hooks/useVideoChat'
import { LastUsedSlot, rememberLastUsedPath } from '../../utils/lastUsedPaths'
import { selectedAccountId } from '../../ScreenController'
import Icon from '../Icon'

import { ContextMenuItem } from '../ContextMenu'
import { ContextMenuContext } from '../../contexts/ContextMenuContext'

import type { T } from '@deltachat/jsonrpc-client'
import { BackendRemote } from '../../backend-com'
import ConfirmSendingFiles from '../dialogs/ConfirmSendingFiles'
import useMessage from '../../hooks/chat/useMessage'
import SmallSelectDialogPrivitty from '../SmallSelectDialogPrivitty'

import {
  PRV_APP_STATUS_SEND_PEER_PDU,
  PRV_EVENT_ADD_NEW_PEER,
} from '../../../../target-electron/src/privitty/privitty_type'
import { useSharedData } from '../../contexts/FileAttribContext'
//import { set } from 'immutable'

type Props = {
  addFileToDraft: (file: string, fileName: string, viewType: T.Viewtype) => void
  showAppPicker: (show: boolean) => void
  selectedChat: Pick<T.BasicChat, 'name' | 'id'> | null
}

// Main component that creates the menu and popover
export default function MenuAttachment({
  addFileToDraft,
  showAppPicker,
  selectedChat,
}: Props) {
  const { openContextMenu } = useContext(ContextMenuContext)

  const tx = useTranslationFunction()
  const openConfirmationDialog = useConfirmationDialog()
  const { sendVideoChatInvitation } = useVideoChat()
  const { openDialog, closeDialog } = useDialog()
  const { sendMessage } = useMessage()
  const [settings] = useStore(SettingsStoreInstance)
  const accountId = selectedAccountId()
  const { sharedData, setSharedData } = useSharedData()

  const confirmSendMultipleFiles = (
    filePaths: string[],
    msgViewType: T.Viewtype
  ) => {
    if (!selectedChat) {
      throw new Error('no chat selected')
    }
    openDialog(ConfirmSendingFiles, {
      sanitizedFileList: filePaths.map(path => ({ name: basename(path) })),
      chatName: selectedChat.name,
      onClick: async (isConfirmed: boolean) => {
        if (!isConfirmed) {
          return
        }

        for (const filePath of filePaths) {
          await sendMessage(
            accountId,
            selectedChat.id,
            {
              file: filePath,
              filename: basename(filePath),
              viewtype: msgViewType,
            },
            sharedData
          )
          // start sending other files, don't wait until last file is sent
          if (runtime.getRuntimeInfo().target === 'browser') {
            // browser created temp files during upload that can now be cleaned up
            runtime.removeTempFile(filePath)
          }
        }
      },
    })
  }

  const addFilenameFileMod = async () => {
    // function for files
    const { defaultPath, setLastPath } = await rememberLastUsedPath(
      LastUsedSlot.Attachment
    )
    const files = await runtime.showOpenFileDialog({
      filters: [
        {
          name: 'pdf Files',
          extensions: ['pdf'],
        },
      ],
      properties: ['openFile' /*, 'multiSelections'*/],
      defaultPath,
    })

    if (files.length === 1) {
      setLastPath(dirname(files[0]))
      let filePathName = files[0].replace(/\\/g, '/')
      let encryptedFile: string = await runtime.PrivittySendMessage(
          'encryptFile',
          {
            chatId: selectedChat?.id || 0,
            filePath: dirname(filePathName),
            fileName: basename(filePathName),
            deleteInputFile: false,
          }
        )
        console.log('encryptedFile:', encryptedFile)
        let data = JSON.parse(encryptedFile)
        console.log('result[0]:', data.result)
        let fileName = JSON.parse(data.result).encryptedFile
        console.log('parsed filename:', fileName)

      addFileToDraft(fileName, basename(fileName), 'File')
      setSharedData({
            allowDownload: fileAttribute.allowDownload,
            allowForward: fileAttribute.allowForward,
            allowedTime: fileAttribute.allowedTime,
            FileDirectory: fileName
          })
      
    } else if (files.length > 1) {
      confirmSendMultipleFiles(files, 'File')
    }
  }
let fileAttribute: {
      allowDownload: boolean
      allowForward: boolean
      allowedTime: string
    }

  const addFilenameFile = async () => {
    
    let smallDialogID = await openDialog(SmallSelectDialogPrivitty, {
      initialSelectedValue: {
        allowDownload: false,
        allowForward: false,
        allowedTime: '',
      },
      values: [],
      onSave: async (selectedValue: {
        allowDownload: boolean
        allowForward: boolean
        allowedTime: string
      }) => {
        if (selectedValue) {
          fileAttribute = selectedValue
          console.log('Selected value:', selectedValue)
          
        }
        closeDialog(smallDialogID);
        await addFilenameFileMod();
      },
      title: 'File Attributes',
      onClose: async (isConfirmed: boolean) => {
        closeDialog(smallDialogID)
        if (!isConfirmed) {
          return
        }
      },
      onCancel: () => {
        console.log('Dialog cancelled')
        closeDialog(smallDialogID)
        return
      },
    })
  }

  const addFilenameMedia = async () => {
    // function for media
    const { defaultPath, setLastPath } = await rememberLastUsedPath(
      LastUsedSlot.Attachment
    )
    const files = await runtime.showOpenFileDialog({
      filters: [
        {
          name: tx('image'),
          extensions: IMAGE_EXTENSIONS,
        },
      ],
      properties: ['openFile', 'multiSelections'],
      defaultPath,
    })

    if (files.length === 1) {
      setLastPath(dirname(files[0]))
      addFileToDraft(files[0], basename(files[0]), 'Image')
    } else if (files.length > 1) {
      confirmSendMultipleFiles(files, 'Image')
    }
  }

  const onVideoChat = useCallback(async () => {
    if (!selectedChat) {
      return
    }

    const confirmed = await openConfirmationDialog({
      header: tx('videochat_invite_user_to_videochat', selectedChat.name),
      message: tx('videochat_invite_user_hint'),
      confirmLabel: tx('ok'),
    })

    if (confirmed) {
      sendVideoChatInvitation(accountId, selectedChat.id)
    }
  }, [
    accountId,
    openConfirmationDialog,
    selectedChat,
    sendVideoChatInvitation,
    tx,
  ])

  const selectContact = async () => {
    let dialogId = ''
    /**
     * TODO: reduce the overhead: just provide a vcardContact to draft/message
     * and send it as a message. No need to get the vcard from core to create
     * a tmp file to attach it as a file which is then converted into a vcardContact again
     * see https://github.com/deltachat/deltachat-core-rust/pull/5677
     */
    const addContactAsVcard = async (selectedContact: T.Contact) => {
      if (selectedContact) {
        const vCardContact = await BackendRemote.rpc.makeVcard(
          selectedAccountId(),
          [selectedContact.id]
        )
        // Use original name set by contact instead of nickname chosen by user
        const cleanAuthname = (
          selectedContact.authName || selectedContact.address
        ).replace(/[^a-z_A-Z0-9]/gi, '')
        const fileName = `VCard-${cleanAuthname}.vcf`
        const tmp_file = await runtime.writeTempFile(fileName, vCardContact)
        addFileToDraft(tmp_file, fileName, 'Vcard')
        closeDialog(dialogId)
      }
    }
    dialogId = openDialog(SelectContactDialog, { onOk: addContactAsVcard })
  }

  const selectAppPicker = async () => {
    showAppPicker(true)
  }

  // item array used to populate menu
  const menu: (ContextMenuItem | false)[] = [
    {
      icon: 'person',
      label: tx('contact'),
      action: selectContact.bind(null),
    },
    !!settings?.settings.webrtc_instance && {
      icon: 'phone',
      label: tx('videochat'),
      action: onVideoChat,
    },
    {
      icon: 'apps',
      label: tx('webxdc_app'),
      action: selectAppPicker.bind(null),
      dataTestid: 'open-app-picker',
    },
    {
      icon: 'upload-file',
      label: tx('file'),
      action: addFilenameFile.bind(null),
    },
    { type: 'separator' },
    {
      icon: 'image',
      label: tx('image'),
      action: addFilenameMedia.bind(null),
    },
  ]

  const onClickAttachmentMenu = async (
    event: React.MouseEvent<any, MouseEvent>
  ) => {
    const result = await runtime.PrivittySendMessage(
      'isChatPrivittyProtected',
      {
        chatId: selectedChat?.id,
      }
    )
    console.log('isChatPrivittyProtected response MenuAttachment', result)
    if (result) {
      try {
        const resp = JSON.parse(result)
        if (resp.result === 'false') {
          const accountid: number =
            (await BackendRemote.rpc.getSelectedAccountId()) || 0
          const basicChat = await BackendRemote.rpc.getBasicChatInfo(
            accountid,
            selectedChat?.id || 0
          )
          console.log('accountid =', accountid, 'BasicChat =', basicChat)
          const addpeerResponse = await runtime.PrivittySendMessage(
            'produceEvent',
            {
              eventType: PRV_EVENT_ADD_NEW_PEER,
              mID: '',
              mName: basicChat.name,
              msgId: basicChat.id,
              fromId: 0,
              chatId: selectedChat?.id,
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
              selectedChat?.id || 0,
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

    const attachmentMenuButtonElement = document.querySelector(
      '#attachment-menu-button'
    ) as HTMLDivElement

    const boundingBox = attachmentMenuButtonElement.getBoundingClientRect()

    const [x, y] = [boundingBox.x, boundingBox.y]
    event.preventDefault() // prevent default runtime context menu from opening

    openContextMenu({
      x,
      y,
      items: menu,
    })
  }

  return (
    <button
      aria-label={tx('menu_add_attachment')}
      id='attachment-menu-button'
      data-testid='open-attachment-menu'
      className='attachment-button'
      onClick={onClickAttachmentMenu}
    >
      <Icon coloring='contextMenu' icon='paperclip' />
    </button>
  )
}
