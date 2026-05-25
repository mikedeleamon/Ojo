import jwt from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;
  ver: number;
}

export const signToken = (userId: string, tokenVersion: number): string =>
  jwt.sign({ sub: userId, ver: tokenVersion }, process.env.JWT_SECRET!, { expiresIn: '30d' });

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
