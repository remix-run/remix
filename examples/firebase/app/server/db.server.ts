import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";

// helper function to convert firestore data to typescript
const converter = <T>() => ({
  toFirestore: (data: T) => data,
  fromFirestore: (snap: QueryDocumentSnapshot) => snap.data() as T,
});

// helper to apply converter to multiple collections
const dataPoint = <T>(collectionPath: string) =>
  getFirestore().collection(collectionPath).withConverter(converter<T>());

export type Todo = {
  id: string;
  title: string;
};

const db = {
  userTodos: (uid: string) => dataPoint<Todo>(`users/${uid}/todos`),
};

export const getUserTodos = async (uid: string): Promise<Todo[]> => {
  const todoSnap = await db.userTodos(uid).get();
  const todoData = todoSnap.docs.map((doc) => doc.data());
  return todoData;
};

export const addTodo = async (uid: string, title: string) => {
  const newTodoRef = db.userTodos(uid).doc();
  await newTodoRef.set({ title, id: newTodoRef.id });
};

export const removeTodo = async (uid: string, todoId: string) => {
  await db.userTodos(uid).doc(todoId).delete();
};
