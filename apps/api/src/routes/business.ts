import { Hono } from 'hono';
import { apiErrorSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import * as schema from '../db/schema';
import { withDatabase } from '../db';



export const businessRoutes = new Hono<ApiEnvironment>();

// A truthful placeholder, not mock user/workspace data or an authentication bypass.
businessRoutes.get('/me', (c) => c.json(apiErrorSchema.parse({
  error: { code: 'NOT_IMPLEMENTED', message: 'Profile and session integration is not implemented.' },
}), 501));

businessRoutes.put('/db/user', async (c) => {
  c.header('Cache-Control', 'no-store');
  try{
    const res = await withDatabase(c.env, (db) => {
    return db.insert(schema.user).values({id: "1234567890", name: "tesing", email: "abc@gmail.com"});
    });
    console.log("success: ", res);
    return c.json(res);
  }catch(error){
    return c.json(error);
  }
  
  
})