import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './FormInput.module.css';
const FormInput = ({ label, type, value, onChange, placeholder, id, }) => (_jsx("div", { className: 'form-group mb-4', children: _jsxs("label", { htmlFor: id, children: [label, _jsx("input", { type: type, 
                //if it's looking dumb, return to form-control
                className: styles.formInput, id: id, placeholder: placeholder, value: value, onChange: onChange })] }) }));
export default FormInput;
