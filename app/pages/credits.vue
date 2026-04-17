<template>
    <main class="w-full flex items-center justify-center bg-black text-white">
        <header ref="headerEl" class="fixed top-0 w-full flex items-center justify-start p-4 z-40">
            <div class="cursor-pointer" @click="navigateTo('/')">
                <img src="~/assets/svg/back.svg" alt="Back" class="h-8 w-10" />
            </div>
        </header>


        <!-- Main Content -->
        <section class="relative flex flex-col items-center justify-center h-dvh w-full max-w-2xl gap-16 pt-[var(--credits-header-h)] pb-4">
            <!-- Credits -->
            <div class="w-full h-full flex flex-col gap-2 px-4 text-lg justify-between items-start text-white/60">
                <div>
                    <p>
                        This is an unofficial, non-commercial fan project. Card content from Cards Against Humanity, used under CC BY-NC-SA 4.0. This project is also released
                        under CC BY-NC-SA 4.0.
                    </p>

                </div>
                <p>
                    Made by<br>
                    <span class="text-white">Karim Pathan </span>(UI/UX Design)<br>
                    <span class="text-white">Eve Steiger </span>(Developer)<br>
                    <span class="text-white">Joel Kammermann </span>(Developer)<br>
                </p>
                <p>
                    We would like to thank our lecturers for their guidance throughout the development process.
                </p>
                <div class="flex flex-col gap-2 w-full">
                    <p>
                        Lucerne University of Applied Sciences and Arts | Digital Ideation<br>
                        Studio UX & Web 2<br>
                        FS26
                    </p>
                    <div class="w-full flex flex-row justify-between items-center">
                        <div class="w-24 h-10 flex items-center justify-start">
                            <img class="max-w-full max-h-full object-contain rounded-full" src="~/assets/img/di-logo.jpg"
                                alt="Digital Ideation logo" />
                        </div>
                        <div class="w-32 h-10 flex items-center justify-end">
                            <img class="max-w-full max-h-full object-contain" src="~/assets/img/hslu-logo-white.png"
                                alt="HSLU logo" />
                        </div>
                    </div>

                </div>
            </div>
        </section>

    </main>
</template>

<script setup>
const { headerEl } = useHeaderHeight("--credits-header-h");
</script>