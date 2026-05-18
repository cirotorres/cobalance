import api from "./api";


export const listFinances = async () => {
  const response = await api.get("/financial/financial-entries");
  return response.data;
};

export const editFinances = async (id, finance) => {
  const response = await api.patch(`/financial/${id}`, finance);
  return response.data
};

export const addFinance = async (payload) => {
  const response = await api.post("/financial/", payload);
  return response.data;
};

export const deleteFinance = async (id) => {
  const response = await api.delete(`/financial/${id}`);
  return response.data;
};

export const deleteExtratoByMonth = async (month) => {
  const response = await api.delete(`/financial/by-month`, {
    params: { month },
  });
  return response.data;
};

export const uploadDocument = async (documento) => {
  const formData = new FormData();
  formData.append("file", documento);
  const response = await api.post(
    "/financial/import-csv",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};