export type Memory = {
  id: string;
  date: string;
  imageUrl: string;
  imagePath?: string;
  createdAt?: string;
  caption: string;
  people: string[];
  tags: string[];
  letter?: string;
};

export type QuizQuestion = {
  id: string;
  memoryId: string;
  question: string;
  choices: string[];
  correctChoice: string;
  hint: string;
};

export type AlbumMonth = {
  key: string;
  label: string;
  message: string;
};

export type MemoryInput = Omit<Memory, "id" | "imageUrl" | "imagePath"> & {
  image: File;
};

export type MemoryUpdateInput = Pick<Memory, "caption" | "date" | "people" | "tags" | "letter">;
