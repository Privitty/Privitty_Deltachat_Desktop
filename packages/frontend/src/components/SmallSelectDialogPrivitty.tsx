import React, { useState } from 'react'
import  Checkbox from './Checkbox'
import  TextField  from './Textbox' // Add this import if using MUI, or use your own Checkbox/TextField components
import Dialog, {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  FooterActions,
} from './Dialog'
//import Radio from './Radio'
//import RadioGroup from './RadioGroup'
import FooterActionButton from './Dialog/FooterActionButton'
import useTranslationFunction from '../hooks/useTranslationFunction'

import type { DialogProps } from '../contexts/DialogContext'

export type SelectDialogOption = [value: string, label: string]

export type SelectedValue = {
  allowDownload: boolean
  allowForward: boolean
  allowedTime: string
}

type Props = {
  title: string
  initialSelectedValue: SelectedValue
  values: SelectDialogOption[]
  onSave?: (selectedValue: SelectedValue) => void 
  onSelect?: (selectedValue: SelectedValue) => void 
  onCancel?: () => void
} & DialogProps

export default function SmallSelectDialogPrivitty({
  initialSelectedValue,
  values,
  onSave,
  title,
  onClose,
  onSelect,
  onCancel,
}: Props) {
  const tx = useTranslationFunction()

  const [selectedValue, setActualSelectedValue] =
    useState<SelectedValue>(initialSelectedValue)
  const [allowDownload, setAllowDownload] = useState<boolean>(false)
  const [allowForward, setAllowForward] = useState<boolean>(false)
  const [allowedTime, setAllowedTime] = useState<string>('') // keep as string for controlled input

  const onChange = (value: string) => {
    setAllowedTime(value)
    const newValue = {
      allowDownload,
      allowForward,
      allowedTime: value,
    }
  }

  const saveAndClose = () => {
    onSave && onSave({ allowDownload,
      allowForward,
      allowedTime})
    onClose()
  }
  return (
    <Dialog onClose={onClose}>
      <DialogHeader title={title} />
      <DialogBody>
        <DialogContent>
          <div style={{ marginBottom: 12 }}>
            <Checkbox
              checked={allowDownload}
              onChange={e => setAllowDownload(e.target.checked)}
              label="Allow Download"
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Checkbox
              checked={allowForward}
              onChange={e => setAllowForward(e.target.checked)}
              label="Allow Forward"
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="allowed-time" style={{ display: 'block', marginBottom: 4 }}>
              Allowed time access (mins)
            </label>
            <TextField
              value={allowedTime}
              onChange={e => {
                // Only allow numbers and empty string
                const val = e.target.value
                if (/^\d*$/.test(val)) setAllowedTime(val)
              }}
              placeholder="Enter minutes"
            />
          </div>
        </DialogContent>
      </DialogBody>
      <DialogFooter>
        <FooterActions>
          <FooterActionButton
            onClick={() => {
              onCancel && onCancel()
              onClose()
            }}
          >
            {tx('cancel')}
          </FooterActionButton>
          <FooterActionButton styling='primary' onClick={saveAndClose}>
            {tx('save_desktop')}
          </FooterActionButton>
        </FooterActions>
      </DialogFooter>
    </Dialog>
  )
}
