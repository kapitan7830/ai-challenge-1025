Сначала для эксперимента были взяты модели SmolLM3-3B из huggingface, Yandex GPT 5 Lite и GPT-4o-mini но выяснилось что они справляются с задачами примерно на одном уровне, поэтому GPT-4o-mini был заменен на Arch-Router-1.5B

Разным моделям были заданы вопросы, выводы по ним ниже:

1) farmer needs to cross a river with a fox, a chicken, and a bag of grain. The boat can only carry the farmer and one item. If left alone, the fox will eat the chicken, and the chicken will eat the grain. How does the farmer cross? Keep your answer brief.
   
   - SmolLM3-3B 192 tokens 1.70s справилась с задачей
   - Arch-Router-1.5B 159 tokens 1.13s не справилась
   - YandexGPT 5 Lite 120 tokens 1.44s справился и был более лаконичен

2) Write a JavaScript function that reverses a string without using built-in reverse methods. Explain time complexity. Keep your answer brief.

   - SmolLM3-3B 190 tokens 1.96s справился, правда сгенерил 2 функции, одну так как не надо было делать исходя из задачи
   - Arch-Router-1.5B 1.48s 155 tokens справился
   - YandexGPT 5 Lite 2.58s 152 tokens справился на том же уровне, что и предыдущая модель

3) Solve the equation: 3x + 7 = 22. Show your work step by step. Keep your answer brief and concise.

   - SmolLM3-3B 182 tokens 1.61s справился
   - Arch-Router-1.5B 195 tokens 1.84s справился
   - YandexGPT 5 Lite 228 tokens 3.48s справился

4) What were the main causes of World War I? List 3-4 key factors. Keep your answer brief and to the point.

   Тут все дали похожие ответы, самым быстрым и лаконичным оказался яндекс

   - SmolLM3-3B 233 tokens 2.53s 
   - Arch-Router-1.5B 235 tokens 2.45s
   - YandexGPT 5 Lite 121 tokens 1.20s

5) Write a two-sentence horror story. Keep it brief but impactful.
   
   Почему-то все выбрали рассказ про заброшенный дом, в принципе справились нормально

   - SmolLM3-3B 137 tokens 1.53s
   - Arch-Router-1.5B 83 tokens 0.78s
   - YandexGPT 5 Lite 86 tokens 0.94s

В целом для небольших задач как будто бы нет особо разницы, а значит и смысла платить за тот же яндекс Arch-Router-1.5B справляется чуть хуже остальных, но опять же для мелких задач почему бы и нет.

Задавал так же вопросы из истории своих запросов Perplexity не под запись, с какими-то небольшими вопросами справляются примерно одинаково, но первые две, к примеру, начинают нести полную отсебятину, если не знают ответа и игнорируют требование писать на английском, если задавать вопрос по-русски😂

А на запрос "claude code vs cursor" правильно ответила только самая простая модель, кто на чем обучен еще видимо. А на вопрос "Как умер Берия" эта же моделька сочинила историю про бедного мальчика из Беларуси.