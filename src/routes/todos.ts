import { Router, type Request, type Response } from 'express';
import type { Db, WithId, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { HttpError } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import type { Todo } from '../contract';

// ── internal document shape stored in MongoDB ──

interface TodoDoc {
  _id: ObjectId;
  userId: string;
  title: string;
  notes?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── helper: map MongoDB doc → contract Todo ──

function toTodo(doc: WithId<Document> | TodoDoc): Todo {
  const d = doc as TodoDoc;
  return {
    id: d._id.toString(),
    userId: d.userId,
    title: d.title,
    notes: d.notes,
    priority: d.priority,
    dueDate: d.dueDate,
    completed: d.completed,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

// ── valid priority values ──

const VALID_PRIORITIES: ReadonlySet<string> = new Set(['low', 'medium', 'high', 'urgent']);

// ── route factory ──

export function createTodosRouter(db: Db): Router {
  const router = Router();
  const todos = db.collection<TodoDoc>('todos');

  // ── GET /api/todos — list all todos for the authenticated user ──────────
  router.get('/', requireAuth, async (req: Request, res: Response) => {
    const docs = await todos
      .find({ userId: req.userId! })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(docs.map(toTodo));
  });

  // ── POST /api/todos — create a new todo ──────────────────────────────────
  router.post('/', requireAuth, async (req: Request, res: Response) => {
    const body = req.body as Partial<Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      throw new HttpError(400, 'A todo title is required.');
    }
    if (!body.priority || !VALID_PRIORITIES.has(body.priority)) {
      throw new HttpError(400, 'Priority must be one of: low, medium, high, urgent.');
    }
    if (typeof body.completed !== 'boolean') {
      throw new HttpError(400, 'completed must be a boolean.');
    }
    if (!('dueDate' in body)) {
      throw new HttpError(400, 'dueDate is required (use null if none).');
    }
    if (body.dueDate !== null && typeof body.dueDate !== 'string') {
      throw new HttpError(400, 'dueDate must be an ISO date string or null.');
    }

    const now = new Date().toISOString();
    const doc: TodoDoc = {
      _id: new ObjectId(),
      userId: req.userId!,
      title: body.title.trim(),
      priority: body.priority as TodoDoc['priority'],
      dueDate: body.dueDate ?? null,
      completed: body.completed,
      createdAt: now,
      updatedAt: now,
    };

    if (body.notes !== undefined) {
      if (typeof body.notes !== 'string') {
        throw new HttpError(400, 'notes must be a string.');
      }
      doc.notes = body.notes;
    }

    await todos.insertOne(doc);
    res.status(201).json(toTodo(doc));
  });

  // ── PATCH /api/todos/:id — update fields on an existing todo ─────────────
  router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid todo id.');
    }

    const objectId = new ObjectId(id);

    // Confirm the todo exists and belongs to the user
    const existing = await todos.findOne({ _id: objectId, userId: req.userId! });
    if (!existing) {
      throw new HttpError(404, 'Todo not found.');
    }

    const body = req.body as Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>;

    // Build the $set object from allowed mutable fields
    const updates: Partial<Omit<TodoDoc, '_id' | 'userId' | 'createdAt'>> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        throw new HttpError(400, 'title must be a non-empty string.');
      }
      updates.title = body.title.trim();
    }

    if (body.notes !== undefined) {
      if (typeof body.notes !== 'string') {
        throw new HttpError(400, 'notes must be a string.');
      }
      updates.notes = body.notes;
    }

    if (body.priority !== undefined) {
      if (!VALID_PRIORITIES.has(body.priority)) {
        throw new HttpError(400, 'Priority must be one of: low, medium, high, urgent.');
      }
      updates.priority = body.priority as TodoDoc['priority'];
    }

    if (body.dueDate !== undefined) {
      if (body.dueDate !== null && typeof body.dueDate !== 'string') {
        throw new HttpError(400, 'dueDate must be an ISO date string or null.');
      }
      updates.dueDate = body.dueDate;
    }

    if (body.completed !== undefined) {
      if (typeof body.completed !== 'boolean') {
        throw new HttpError(400, 'completed must be a boolean.');
      }
      updates.completed = body.completed;
    }

    updates.updatedAt = new Date().toISOString();

    const result = await todos.findOneAndUpdate(
      { _id: objectId, userId: req.userId! },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new HttpError(404, 'Todo not found.');
    }

    res.status(200).json(toTodo(result));
  });

  // ── DELETE /api/todos/:id — delete a todo ────────────────────────────────
  router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid todo id.');
    }

    const result = await todos.deleteOne({
      _id: new ObjectId(id),
      userId: req.userId!,
    });

    if (result.deletedCount === 0) {
      throw new HttpError(404, 'Todo not found.');
    }

    const response: { ok: boolean } = { ok: true };
    res.status(200).json(response);
  });

  return router;
}
