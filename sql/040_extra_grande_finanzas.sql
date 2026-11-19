-- 040: el tamaño "extra_grande" ahora se llama "extra_grande_50".
-- Si en Finanzas algún producto tomaba su precio de "extra_grande", se cambia al nuevo nombre.
-- Si no había ninguno, no cambia nada. Se puede correr más de una vez.
update fin_recetas set precio_catalogo = 'tamanos_pastel:extra_grande_50'
where precio_catalogo = 'tamanos_pastel:extra_grande';
