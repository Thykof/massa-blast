function mixRandomChars(length: i32): string {
  let result = '';
  let characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(
      Math.floor((Math.random() as i32) * charactersLength) as i32,
    );
  }
  return result;
}

export function generateDumbAddress(): string {
  return 'A12' + mixRandomChars(47 as i32);
}
