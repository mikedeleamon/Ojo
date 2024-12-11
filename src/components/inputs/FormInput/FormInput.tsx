import React from 'react';
import styles from './FormInput.module.css';

interface FormInputProps {
    label: string;
    type: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    id: string;
}

const FormInput = ({
    label,
    type,
    value,
    onChange,
    placeholder,
    id,
}: FormInputProps) => (
    <div className='form-group mb-4'>
        <label htmlFor={id}>
            {label}
            <input
                type={type}
                //if it's looking dumb, return to form-control
                className={styles.formInput}
                id={id}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
            />
        </label>
    </div>
);

export default FormInput;
