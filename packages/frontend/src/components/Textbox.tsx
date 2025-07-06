import React from 'react'

export interface TextboxProps {
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}

const Textbox: React.FC<TextboxProps> = ({ value, onChange, placeholder }) => {
  return (
    <input
      type='text'
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className='textbox'
    />
  )
}

export default Textbox
