import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import styles from '../BalancoTab/BalancoTab.module.css'

export default function PizzaGraph({financas}) {

const dataGrafico = financas.map(grupo => {

  const totalAmount = grupo.items.reduce((soma, item) => soma + (item.amount || 0), 0);
  const participanteDoGrupo = grupo.participant
  const participanteColor = grupo.participant

  return {
    name: participanteDoGrupo.name,
    value: totalAmount,
    color: participanteColor.color
  };
});

const total = dataGrafico.reduce(
  (soma, item) => soma + item.value,
  0
);

const totalFormatado = total.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

  return (
    <ResponsiveContainer width="100%" minWidth={260} height={300}>
      <PieChart label={()=>{return (<text>Ola meu amigo</text>)}}>
      <Tooltip formatter={(value) => [`R$ ${value}`]}/>
          <Pie
              data={dataGrafico}
              dataKey="value"
              nameKey="name"
              outerRadius={110}
              innerRadius={60}
              activeShape={false}
              isAnimationActive={true}
              animationDuration={1500}
              label={({ name, percent, x, y }) => {
                return (
                  <text
                    x={x}
                    y={y}
                    fill="black"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={16}
                    fontWeight='bold'
                  >
                    {name} - {(percent * 100).toFixed(0)}%
                  </text>
                );
              }}
            >
          {dataGrafico.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.7}/>
          ))}
        </Pie>
        <g className={styles.textFade}>
        <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={16}
            fontWeight="bold"
          >
          {totalFormatado}
        </text>

        <text
          x="50%"
          y="55%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fill="gray"
        >
          Total
        </text>
        </g>
      </PieChart>
    </ResponsiveContainer>
  );
}