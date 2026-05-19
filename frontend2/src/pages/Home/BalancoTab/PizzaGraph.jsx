import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';


const data = [
  { name: 'Grupo A', value: 500 },
  { name: 'Grupo B', value: 300 },
  { name: 'Grupo C', value: 300 },
  { name: 'Grupo D', value: 900 },
];

const COLORS = ['#0087fece', '#00C49F', '#FFBB28', '#b63939c5'];

export default function PizzaGraph({participantes, financas}) {

const participants = participantes.map(p => p.name)
const colors_participants = participantes.map(p => p.color)
const grupos = financas
console.log("GROUPS:",grupos)
console.log(colors_participants)
console.log(participants)
console.log(participantes)

// const filtered_finances = grupos.map(f => f.items)
// console.log(filtered_finances.map(i => i.amount))

// const totalPorGrupo = grupos.map(grupo => {
//   return grupo.items.reduce((soma, item) => soma + (item.amount || 0), 0);
// });

// console.log("Total de cada grupo:", totalPorGrupo);


// Cria a lista de objetos formatada para o gráfico
const dataGrafico = grupos.map(grupo => {
  // 1. Soma os amounts dos itens deste grupo específico
  const totalAmount = grupo.items.reduce((soma, item) => soma + (item.amount || 0), 0);
  const participanteDoGrupo = grupo.participant

  // 2. Retorna o objeto com a estrutura que você precisa
  return {
    name: participanteDoGrupo.name,          // Copia o ID do grupo
    value: totalAmount     // Define a soma como o 'value'
  };
});

console.log("Dados formatados para o gráfico:", dataGrafico);

  return (
    <ResponsiveContainer width="40%" height={250}>
      <PieChart>
        <Pie data={dataGrafico} dataKey="value" nameKey="name" outerRadius={90} fill="#8884d8" label>
          {participantes.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors_participants[index % colors_participants.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}