export const formatDate = (e) => {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length >= 3) value = value.slice(0, 2) + '/' + value.slice(2);
  if (value.length >= 6) value = value.slice(0, 5) + '/' + value.slice(5, 9);
  return value;
};
